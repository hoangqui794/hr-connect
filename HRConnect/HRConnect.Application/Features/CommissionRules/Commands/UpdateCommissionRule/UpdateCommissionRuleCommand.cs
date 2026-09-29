using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CommissionRules.Commands.UpdateCommissionRule;

public sealed class UpdateCommissionRuleCommand : IRequest<UpdateCommissionRuleResponse>
{
    public Guid CommissionRuleId { get; set; }
    public string RateType { get; init; } = string.Empty;
    public decimal RateValue { get; init; }
    public bool WarrantyRequired { get; init; }
    public DateTime EffectiveFrom { get; init; }
    public DateTime? EffectiveTo { get; init; }
}

public sealed record UpdatedCommissionRuleDto(
    Guid CommissionRuleId,
    Guid ServiceTypeId,
    string ServiceTypeCode,
    string ServiceTypeName,
    string Name,
    string MilestoneType,
    string? MilestoneName,
    string RateType,
    decimal RateValue,
    bool WarrantyRequired,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record UpdateCommissionRuleResponse(
    bool Success,
    string Message,
    UpdatedCommissionRuleDto Data);

public sealed class UpdateCommissionRuleCommandValidator : AbstractValidator<UpdateCommissionRuleCommand>
{
    public UpdateCommissionRuleCommandValidator()
    {
        RuleFor(command => command.RateType)
            .NotEmpty()
            .Must(rateType => new[] { "PERCENT", "FIXED" }
                .Contains(rateType.Trim().ToUpperInvariant()))
            .WithMessage("Loại hoa hồng phải là PERCENT hoặc FIXED.");
        RuleFor(command => command.RateValue)
            .GreaterThan(0).WithMessage("Giá trị hoa hồng phải lớn hơn 0.");
        RuleFor(command => command.RateValue)
            .LessThanOrEqualTo(100)
            .When(command => string.Equals(command.RateType, "PERCENT", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Giá trị hoa hồng theo phần trăm không được vượt quá 100.");
        RuleFor(command => command.EffectiveFrom)
            .NotEqual(default(DateTime)).WithMessage("Thời điểm áp dụng là bắt buộc.");
        RuleFor(command => command.EffectiveTo)
            .GreaterThan(command => command.EffectiveFrom)
            .When(command => command.EffectiveTo.HasValue)
            .WithMessage("Thời điểm kết thúc phải sau thời điểm áp dụng.");
    }
}

public sealed class UpdateCommissionRuleCommandHandler
    : IRequestHandler<UpdateCommissionRuleCommand, UpdateCommissionRuleResponse>
{
    private readonly ICommissionRuleRepository _rules;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCommissionRuleCommandHandler(
        ICommissionRuleRepository rules,
        IUnitOfWork unitOfWork)
    {
        _rules = rules;
        _unitOfWork = unitOfWork;
    }

    public async Task<UpdateCommissionRuleResponse> Handle(
        UpdateCommissionRuleCommand request,
        CancellationToken cancellationToken)
    {
        var rule = await _rules.GetForUpdateAsync(request.CommissionRuleId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy quy tắc hoa hồng.");

        if (rule.IsActive && await _rules.ExistsAnotherActiveAtEffectiveFromAsync(
                rule.ServiceTypeId,
                rule.MilestoneType ?? string.Empty,
                request.EffectiveFrom,
                rule.CommissionRuleId,
                cancellationToken))
        {
            throw new ConflictException(
                "Đã có quy tắc hoa hồng đang hoạt động cho loại dịch vụ, mốc và thời điểm hiệu lực này.");
        }

        rule.RateType = request.RateType.Trim().ToUpperInvariant();
        rule.RateValue = request.RateValue;
        rule.WarrantyRequired = request.WarrantyRequired;
        rule.EffectiveFrom = request.EffectiveFrom;
        rule.EffectiveTo = request.EffectiveTo;
        rule.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new(true, "Cập nhật quy tắc hoa hồng thành công.", ToDto(rule));
    }

    internal static UpdatedCommissionRuleDto ToDto(HRConnect.Domain.Entities.CommissionRule rule) => new(
        rule.CommissionRuleId,
        rule.ServiceTypeId,
        rule.ServiceType.Code,
        rule.ServiceType.Name,
        rule.Name,
        rule.MilestoneType ?? string.Empty,
        rule.MilestoneTypeNavigation?.Name,
        rule.RateType ?? string.Empty,
        rule.RateValue ?? 0,
        rule.WarrantyRequired,
        rule.EffectiveFrom ?? default,
        rule.EffectiveTo,
        rule.IsActive,
        rule.CreatedAt,
        rule.UpdatedAt);
}
