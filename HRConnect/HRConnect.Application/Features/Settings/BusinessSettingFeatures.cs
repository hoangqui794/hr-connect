using System.Collections.Concurrent;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Settings;

public sealed class BusinessSettingsService : IAdminBusinessSettings
{
    private static readonly TimeSpan SharedCacheDuration = TimeSpan.FromMinutes(2);
    private static readonly ConcurrentDictionary<string, ( string? RawValue, DateTime ExpiresAt )> SharedCache = new();
    private static DateTime _allLoadedExpiresAt = DateTime.MinValue;

    private readonly ISystemSettingRepository _repository;
    private readonly bool _enableSharedCache;

    public BusinessSettingsService(ISystemSettingRepository repository, bool enableSharedCache = false)
    {
        _repository = repository;
        _enableSharedCache = enableSharedCache;
    }

    public static void InvalidateSharedCache()
    {
        SharedCache.Clear();
        _allLoadedExpiresAt = DateTime.MinValue;
    }

    public async Task<decimal> GetDecimalAsync(string key, CancellationToken cancellationToken = default)
    {
        var definition = BusinessSettingKeys.Get(key);
        if (_enableSharedCache)
        {
            var now = DateTime.UtcNow;
            if (now < _allLoadedExpiresAt && SharedCache.TryGetValue(key, out var cached) && now < cached.ExpiresAt)
            {
                return cached.RawValue != null && BusinessSettingKeys.TryParse(definition, cached.RawValue, out var cachedVal)
                    ? cachedVal
                    : definition.DefaultValue;
            }

            var allRows = await _repository.GetAllAsync(cancellationToken);
            var expiresAt = now.Add(SharedCacheDuration);
            var lookup = allRows.ToDictionary(r => r.SettingKey, r => r.Value);
            foreach (var def in BusinessSettingKeys.All)
            {
                lookup.TryGetValue(def.Key, out var raw);
                SharedCache[def.Key] = (raw, expiresAt);
            }
            _allLoadedExpiresAt = expiresAt;

            return lookup.TryGetValue(key, out var rawVal) && BusinessSettingKeys.TryParse(definition, rawVal, out var parsedVal)
                ? parsedVal
                : definition.DefaultValue;
        }

        var row = await _repository.GetAsync(key, cancellationToken);
        // A stored value outside the allowed range (edited by hand in the database) falls back to the default.
        return row != null && BusinessSettingKeys.TryParse(definition, row.Value, out var value) ? value : definition.DefaultValue;
    }

    public async Task<int> GetIntAsync(string key, CancellationToken cancellationToken = default) =>
        (int)await GetDecimalAsync(key, cancellationToken);
}

public sealed record BusinessSettingDto(
    string Key, string Group, string Label, string Description, string Type, decimal Value, decimal DefaultValue,
    decimal Min, decimal Max, string Unit, string Source, bool IsOverridden, Guid? UpdatedBy, DateTime? UpdatedAt,
    string? UpdatedByName = null);

public sealed record GetBusinessSettingsQuery : IRequest<IReadOnlyList<BusinessSettingDto>>;

public sealed record UpdateBusinessSettingCommand(string Key, decimal Value, Guid CurrentUserId) : IRequest<BusinessSettingDto>;

public sealed record BusinessSettingBatchItem(string Key, decimal Value);

public sealed record UpdateBusinessSettingsBatchCommand(
    IReadOnlyList<BusinessSettingBatchItem> Items,
    Guid CurrentUserId) : IRequest<IReadOnlyList<BusinessSettingDto>>;

public sealed class BusinessSettingHandlers :
    IRequestHandler<GetBusinessSettingsQuery, IReadOnlyList<BusinessSettingDto>>,
    IRequestHandler<UpdateBusinessSettingCommand, BusinessSettingDto>,
    IRequestHandler<UpdateBusinessSettingsBatchCommand, IReadOnlyList<BusinessSettingDto>>
{
    private readonly ISystemSettingRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly IUserRepository? _users;

    public BusinessSettingHandlers(
        ISystemSettingRepository repository, IUnitOfWork unitOfWork, IAuditLogService auditLogService, IUserRepository? users = null)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _users = users;
    }

    public async Task<IReadOnlyList<BusinessSettingDto>> Handle(GetBusinessSettingsQuery request, CancellationToken cancellationToken)
    {
        var rows = (await _repository.GetAllAsync(cancellationToken)).ToDictionary(r => r.SettingKey);
        // Admin › Cài đặt shows who last changed each number, not just a user id.
        var names = new Dictionary<Guid, string>();
        if (_users != null)
        {
            foreach (var userId in rows.Values.Select(r => r.UpdatedBy).OfType<Guid>().Distinct())
            {
                var user = await _users.GetByIdAsync(userId, cancellationToken);
                if (user != null) names[userId] = user.Email;
            }
        }
        return BusinessSettingKeys.All
            .Select(d => ToDto(d, rows.GetValueOrDefault(d.Key), names))
            .ToList();
    }

    public async Task<BusinessSettingDto> Handle(UpdateBusinessSettingCommand request, CancellationToken cancellationToken)
    {
        var updated = await ApplyUpdatesAsync([new BusinessSettingBatchItem(request.Key, request.Value)], request.CurrentUserId, cancellationToken);
        return updated[0];
    }

    public Task<IReadOnlyList<BusinessSettingDto>> Handle(UpdateBusinessSettingsBatchCommand request, CancellationToken cancellationToken)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new BadRequestException("Danh sách cấu hình cần cập nhật không được để trống.");
        }

        return ApplyUpdatesAsync(request.Items, request.CurrentUserId, cancellationToken);
    }

    private async Task<IReadOnlyList<BusinessSettingDto>> ApplyUpdatesAsync(
        IReadOnlyList<BusinessSettingBatchItem> items, Guid currentUserId, CancellationToken cancellationToken)
    {
        var parsedOverrides = new Dictionary<string, (BusinessSettingDefinition Def, decimal Value)>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            var definition = BusinessSettingKeys.All.FirstOrDefault(d => d.Key == item.Key)
                ?? throw new NotFoundException("Không tìm thấy cấu hình này.");
            if (!BusinessSettingKeys.TryParse(definition, BusinessSettingKeys.Format(item.Value), out var value))
            {
                var integer = definition.Type == BusinessSettingType.Integer ? " (số nguyên)" : string.Empty;
                throw new BadRequestException(
                    $"Giá trị {definition.Label} phải từ {BusinessSettingKeys.Format(definition.Min)} đến {BusinessSettingKeys.Format(definition.Max)}{integer}.");
            }
            parsedOverrides[definition.Key] = (definition, value);
        }

        await ValidateCrossSettingRulesAsync(parsedOverrides, cancellationToken);

        var now = DateTime.UtcNow;
        var results = new List<BusinessSettingDto>(parsedOverrides.Count);
        foreach (var (definition, value) in parsedOverrides.Values)
        {
            var row = await _repository.GetAsync(definition.Key, cancellationToken);
            var oldValue = row?.Value ?? BusinessSettingKeys.Format(definition.DefaultValue);
            if (row == null)
            {
                row = new SystemSetting { SettingKey = definition.Key };
                await _repository.AddAsync(row, cancellationToken);
            }

            row.Value = BusinessSettingKeys.Format(value);
            row.UpdatedBy = currentUserId;
            row.UpdatedAt = now;

            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.BusinessSettingUpdated,
                EntityType = "SYSTEM_SETTING",
                ActorUserId = currentUserId,
                OldValues = new { key = definition.Key, value = oldValue },
                NewValues = new { key = definition.Key, value = row.Value },
            }, cancellationToken);

            results.Add(ToDto(definition, row));
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        BusinessSettingsService.InvalidateSharedCache();
        return results;
    }

    private async Task ValidateCrossSettingRulesAsync(
        IReadOnlyDictionary<string, (BusinessSettingDefinition Def, decimal Value)> overrides,
        CancellationToken cancellationToken)
    {
        async Task<decimal> ResolveAsync(string key)
        {
            if (overrides.TryGetValue(key, out var ov)) return ov.Value;
            var def = BusinessSettingKeys.Get(key);
            var row = await _repository.GetAsync(key, cancellationToken);
            return row != null && BusinessSettingKeys.TryParse(def, row.Value, out var stored) ? stored : def.DefaultValue;
        }

        if (overrides.ContainsKey(BusinessSettingKeys.AffiliateRatingWeightHire)
            || overrides.ContainsKey(BusinessSettingKeys.AffiliateRatingWeightShortlist))
        {
            var hire = await ResolveAsync(BusinessSettingKeys.AffiliateRatingWeightHire);
            var shortlist = await ResolveAsync(BusinessSettingKeys.AffiliateRatingWeightShortlist);
            if (Math.Abs(hire + shortlist - 1.0m) > 0.001m)
            {
                throw new BadRequestException("Tổng trọng số tuyển được (weight_hire) và qua sàng lọc (weight_shortlist) phải bằng 1.");
            }
        }

        if (overrides.ContainsKey(BusinessSettingKeys.AffiliateRatingExcellentMin)
            || overrides.ContainsKey(BusinessSettingKeys.AffiliateRatingGoodMin)
            || overrides.ContainsKey(BusinessSettingKeys.AffiliateRatingAverageMin))
        {
            var excVal = await ResolveAsync(BusinessSettingKeys.AffiliateRatingExcellentMin);
            var goodVal = await ResolveAsync(BusinessSettingKeys.AffiliateRatingGoodMin);
            var avgVal = await ResolveAsync(BusinessSettingKeys.AffiliateRatingAverageMin);
            if (!(excVal > goodVal && goodVal > avgVal))
            {
                throw new BadRequestException("Ngưỡng đánh giá phải thỏa mãn: Xuất sắc (excellent_min) > Tốt (good_min) > Trung bình (average_min).");
            }
        }

        if (BusinessSettingKeys.AiScoringWeightKeys.Any(overrides.ContainsKey))
        {
            decimal totalWeight = 0m;
            foreach (var key in BusinessSettingKeys.AiScoringWeightKeys)
            {
                totalWeight += await ResolveAsync(key);
            }
            if (Math.Abs(totalWeight - 100m) > 0.001m)
            {
                throw new BadRequestException("Tổng 4 trọng số chấm điểm AI (MUST_HAVE, SHOULD_HAVE, Semantic, LLM Fit) phải bằng 100%.");
            }
        }
    }

    private static BusinessSettingDto ToDto(BusinessSettingDefinition d, SystemSetting? row, IReadOnlyDictionary<Guid, string>? names = null)
    {
        var overridden = row != null && BusinessSettingKeys.TryParse(d, row.Value, out _);
        var value = overridden && BusinessSettingKeys.TryParse(d, row!.Value, out var parsed) ? parsed : d.DefaultValue;
        return new BusinessSettingDto(
            d.Key, d.Group, d.Label, d.Description, d.Type.ToString().ToUpperInvariant(), value, d.DefaultValue,
            d.Min, d.Max, d.Unit, d.Source, overridden, row?.UpdatedBy, row?.UpdatedAt,
            row?.UpdatedBy is Guid by && names != null && names.TryGetValue(by, out var name) ? name : null);
    }
}
