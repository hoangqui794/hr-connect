using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.CommissionRules.Commands.CreateCommissionRule;

public sealed class CreateCommissionRuleCommand : IRequest<CreateCommissionRuleResponse>
{
    public Guid ServiceTypeId { get; init; }
    public string MilestoneType { get; init; } = string.Empty;
    public string RateType { get; init; } = string.Empty;
    public decimal RateValue { get; init; }
    public bool WarrantyRequired { get; init; }
    public DateTime? EffectiveFrom { get; init; }
    public DateTime? EffectiveTo { get; init; }
    public bool IsActive { get; init; } = true;
}

public sealed record CommissionRuleDto(
    Guid CommissionRuleId,
    Guid ServiceTypeId,
    string ServiceTypeCode,
    string Name,
    string MilestoneType,
    string RateType,
    decimal RateValue,
    bool WarrantyRequired,
    DateTime EffectiveFrom,
    DateTime? EffectiveTo,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record CreateCommissionRuleResponse(bool Success, string Message, CommissionRuleDto Data);

public sealed class CreateCommissionRuleCommandValidator : AbstractValidator<CreateCommissionRuleCommand>
{
    public CreateCommissionRuleCommandValidator()
    {
        RuleFor(command => command.ServiceTypeId).NotEmpty().WithMessage("Service Type ID is required.");
        RuleFor(command => command.MilestoneType)
            .NotEmpty().MaximumLength(60)
            .Matches("^[A-Za-z0-9_]+$").WithMessage("Milestone type must be an UPPER_SNAKE_CASE code.");
        RuleFor(command => command.RateType)
            .NotEmpty().Must(rateType => new[] { "PERCENT", "FIXED" }.Contains(rateType.Trim().ToUpperInvariant()))
            .WithMessage("Rate type must be PERCENT or FIXED.");
        RuleFor(command => command.RateValue).GreaterThan(0).WithMessage("Rate value must be greater than zero.");
        RuleFor(command => command.RateValue).LessThanOrEqualTo(100)
            .When(command => string.Equals(command.RateType, "PERCENT", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Percent rate value cannot exceed 100.");
        RuleFor(command => command.EffectiveTo)
            .GreaterThan(command => command.EffectiveFrom!.Value)
            .When(command => command.EffectiveFrom.HasValue && command.EffectiveTo.HasValue)
            .WithMessage("Effective to must be later than effective from.");
    }
}

public sealed class CreateCommissionRuleCommandHandler
    : IRequestHandler<CreateCommissionRuleCommand, CreateCommissionRuleResponse>
{
    private readonly IServiceTypeRepository _serviceTypes;
    private readonly ICommissionMilestoneRepository _milestones;
    private readonly ICommissionRuleRepository _rules;
    private readonly IUnitOfWork _unitOfWork;

    public CreateCommissionRuleCommandHandler(
        IServiceTypeRepository serviceTypes,
        ICommissionMilestoneRepository milestones,
        ICommissionRuleRepository rules,
        IUnitOfWork unitOfWork)
    {
        _serviceTypes = serviceTypes;
        _milestones = milestones;
        _rules = rules;
        _unitOfWork = unitOfWork;
    }

    public async Task<CreateCommissionRuleResponse> Handle(CreateCommissionRuleCommand request, CancellationToken cancellationToken)
    {
        var serviceType = await _serviceTypes.GetByIdAsync(request.ServiceTypeId, cancellationToken);
        if (serviceType is null || !serviceType.IsActive)
            throw new BadRequestException("Service Type does not exist or is inactive.");

        var milestoneType = request.MilestoneType.Trim().ToUpperInvariant();
        var milestone = await _milestones.GetByCodeAsync(milestoneType, cancellationToken);
        if (milestone is null || !milestone.IsActive)
            throw new BadRequestException("Commission milestone does not exist or is inactive.");

        var effectiveFrom = request.EffectiveFrom ?? DateTime.UtcNow;
        var rateType = request.RateType.Trim().ToUpperInvariant();
        if (request.IsActive && await _rules.ExistsActiveAtEffectiveFromAsync(
                request.ServiceTypeId, milestoneType, effectiveFrom, cancellationToken))
        {
            throw new ConflictException("An active Commission Rule already exists for this Service Type, milestone, and effective time.");
        }

        var now = DateTime.UtcNow;
        var rule = new CommissionRule
        {
            CommissionRuleId = Guid.NewGuid(),
            ServiceTypeId = serviceType.ServiceTypeId,
            Name = $"{serviceType.Code} - {milestone.MilestoneCode}",
            MilestoneType = milestone.MilestoneCode,
            RateType = rateType,
            RateValue = request.RateValue,
            WarrantyRequired = request.WarrantyRequired,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = request.EffectiveTo,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _rules.AddAsync(rule, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new(true, "Commission Rule created successfully.", new(
            rule.CommissionRuleId, rule.ServiceTypeId, serviceType.Code, rule.Name,
            rule.MilestoneType, rule.RateType, rule.RateValue.Value, rule.WarrantyRequired,
            rule.EffectiveFrom.Value, rule.EffectiveTo, rule.IsActive, rule.CreatedAt, rule.UpdatedAt));
    }
}
