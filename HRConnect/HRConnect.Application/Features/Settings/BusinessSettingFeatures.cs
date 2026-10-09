using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Settings;

public sealed class BusinessSettingsService : IBusinessSettings
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
