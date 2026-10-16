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
    private readonly ISystemSettingRepository _repository;

    public BusinessSettingsService(ISystemSettingRepository repository)
    {
        _repository = repository;
    }

    public async Task<decimal> GetDecimalAsync(string key, CancellationToken cancellationToken = default)
    {
        var definition = BusinessSettingKeys.Get(key);
        var row = await _repository.GetAsync(key, cancellationToken);
        // A stored value outside the allowed range (edited by hand in the database) falls back to the default.
        return row != null && BusinessSettingKeys.TryParse(definition, row.Value, out var value) ? value : definition.DefaultValue;
    }

    public async Task<int> GetIntAsync(string key, CancellationToken cancellationToken = default) =>
        (int)await GetDecimalAsync(key, cancellationToken);
}

public sealed record BusinessSettingDto(
    string Key, string Group, string Label, string Description, string Type, decimal Value, decimal DefaultValue,
    decimal Min, decimal Max, string Unit, string Source, bool IsOverridden, Guid? UpdatedBy, DateTime? UpdatedAt);

public sealed record GetBusinessSettingsQuery : IRequest<IReadOnlyList<BusinessSettingDto>>;

public sealed record UpdateBusinessSettingCommand(string Key, decimal Value, Guid CurrentUserId) : IRequest<BusinessSettingDto>;

public sealed class BusinessSettingHandlers :
    IRequestHandler<GetBusinessSettingsQuery, IReadOnlyList<BusinessSettingDto>>,
    IRequestHandler<UpdateBusinessSettingCommand, BusinessSettingDto>
{
    private readonly ISystemSettingRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public BusinessSettingHandlers(ISystemSettingRepository repository, IUnitOfWork unitOfWork, IAuditLogService auditLogService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<IReadOnlyList<BusinessSettingDto>> Handle(GetBusinessSettingsQuery request, CancellationToken cancellationToken)
    {
        var rows = (await _repository.GetAllAsync(cancellationToken)).ToDictionary(r => r.SettingKey);
        return BusinessSettingKeys.All.Select(d => ToDto(d, rows.GetValueOrDefault(d.Key))).ToList();
    }

    public async Task<BusinessSettingDto> Handle(UpdateBusinessSettingCommand request, CancellationToken cancellationToken)
    {
        var definition = BusinessSettingKeys.All.FirstOrDefault(d => d.Key == request.Key)
            ?? throw new NotFoundException("Không tìm thấy cấu hình này.");
        if (!BusinessSettingKeys.TryParse(definition, BusinessSettingKeys.Format(request.Value), out var value))
        {
            var integer = definition.Type == BusinessSettingType.Integer ? " (số nguyên)" : string.Empty;
            throw new BadRequestException(
                $"Giá trị phải từ {BusinessSettingKeys.Format(definition.Min)} đến {BusinessSettingKeys.Format(definition.Max)}{integer}.");
        }

        // Validate cross-setting business rules for affiliate rating
        if (definition.Key is BusinessSettingKeys.AffiliateRatingWeightHire or BusinessSettingKeys.AffiliateRatingWeightShortlist)
        {
            var otherKey = definition.Key == BusinessSettingKeys.AffiliateRatingWeightHire
                ? BusinessSettingKeys.AffiliateRatingWeightShortlist
                : BusinessSettingKeys.AffiliateRatingWeightHire;
            var otherDef = BusinessSettingKeys.Get(otherKey);
            var otherRow = await _repository.GetAsync(otherKey, cancellationToken);
            var otherVal = otherRow != null && BusinessSettingKeys.TryParse(otherDef, otherRow.Value, out var ov) ? ov : otherDef.DefaultValue;
            if (Math.Abs(value + otherVal - 1.0m) > 0.001m)
            {
                throw new BadRequestException("Tổng trọng số tuyển được (weight_hire) và qua sàng lọc (weight_shortlist) phải bằng 1.");
            }
        }
        else if (definition.Key is BusinessSettingKeys.AffiliateRatingExcellentMin or BusinessSettingKeys.AffiliateRatingGoodMin or BusinessSettingKeys.AffiliateRatingAverageMin)
        {
            var excDef = BusinessSettingKeys.Get(BusinessSettingKeys.AffiliateRatingExcellentMin);
            var excRow = await _repository.GetAsync(BusinessSettingKeys.AffiliateRatingExcellentMin, cancellationToken);
            var excVal = definition.Key == BusinessSettingKeys.AffiliateRatingExcellentMin ? value
                : (excRow != null && BusinessSettingKeys.TryParse(excDef, excRow.Value, out var ev) ? ev : excDef.DefaultValue);

            var goodDef = BusinessSettingKeys.Get(BusinessSettingKeys.AffiliateRatingGoodMin);
            var goodRow = await _repository.GetAsync(BusinessSettingKeys.AffiliateRatingGoodMin, cancellationToken);
            var goodVal = definition.Key == BusinessSettingKeys.AffiliateRatingGoodMin ? value
                : (goodRow != null && BusinessSettingKeys.TryParse(goodDef, goodRow.Value, out var gv) ? gv : goodDef.DefaultValue);

            var avgDef = BusinessSettingKeys.Get(BusinessSettingKeys.AffiliateRatingAverageMin);
            var avgRow = await _repository.GetAsync(BusinessSettingKeys.AffiliateRatingAverageMin, cancellationToken);
            var avgVal = definition.Key == BusinessSettingKeys.AffiliateRatingAverageMin ? value
                : (avgRow != null && BusinessSettingKeys.TryParse(avgDef, avgRow.Value, out var av) ? av : avgDef.DefaultValue);

            if (!(excVal > goodVal && goodVal > avgVal))
            {
                throw new BadRequestException("Ngưỡng đánh giá phải thỏa mãn: Xuất sắc (excellent_min) > Tốt (good_min) > Trung bình (average_min).");
            }
        }

        var now = DateTime.UtcNow;
        var row = await _repository.GetAsync(definition.Key, cancellationToken);
        var oldValue = row?.Value ?? BusinessSettingKeys.Format(definition.DefaultValue);
        if (row == null)
        {
            row = new SystemSetting { SettingKey = definition.Key };
            await _repository.AddAsync(row, cancellationToken);
        }

        row.Value = BusinessSettingKeys.Format(value);
        row.UpdatedBy = request.CurrentUserId;
        row.UpdatedAt = now;

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.BusinessSettingUpdated,
            EntityType = "SYSTEM_SETTING",
            ActorUserId = request.CurrentUserId,
            OldValues = new { key = definition.Key, value = oldValue },
            NewValues = new { key = definition.Key, value = row.Value },
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToDto(definition, row);
    }

    private static BusinessSettingDto ToDto(BusinessSettingDefinition d, SystemSetting? row)
    {
        var overridden = row != null && BusinessSettingKeys.TryParse(d, row.Value, out _);
        var value = overridden && BusinessSettingKeys.TryParse(d, row!.Value, out var parsed) ? parsed : d.DefaultValue;
        return new BusinessSettingDto(
            d.Key, d.Group, d.Label, d.Description, d.Type.ToString().ToUpperInvariant(), value, d.DefaultValue,
            d.Min, d.Max, d.Unit, d.Source, overridden, row?.UpdatedBy, row?.UpdatedAt);
    }
}
