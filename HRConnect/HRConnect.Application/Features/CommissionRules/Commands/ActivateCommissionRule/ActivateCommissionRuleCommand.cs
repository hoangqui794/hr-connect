using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CommissionRules.Commands.ActivateCommissionRule;

public sealed record ActivateCommissionRuleCommand(Guid CommissionRuleId)
    : IRequest<ActivateCommissionRuleResponse>;

public sealed record ActivateCommissionRuleData(
    Guid CommissionRuleId,
    bool IsActive,
    DateTime UpdatedAt);

public sealed record ActivateCommissionRuleResponse(
    bool Success,
    string Message,
    ActivateCommissionRuleData Data);

public sealed class ActivateCommissionRuleCommandHandler
    : IRequestHandler<ActivateCommissionRuleCommand, ActivateCommissionRuleResponse>
{
    private readonly ICommissionRuleRepository _rules;
    private readonly IUnitOfWork _unitOfWork;

    public ActivateCommissionRuleCommandHandler(
        ICommissionRuleRepository rules,
        IUnitOfWork unitOfWork)
    {
        _rules = rules;
        _unitOfWork = unitOfWork;
    }

    public async Task<ActivateCommissionRuleResponse> Handle(
        ActivateCommissionRuleCommand request,
        CancellationToken cancellationToken)
    {
        var rule = await _rules.GetForUpdateAsync(request.CommissionRuleId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy quy tắc hoa hồng.");

        if (!rule.IsActive)
        {
            var hasConflict = await _rules.ExistsAnotherActiveAtEffectiveFromAsync(
                rule.ServiceTypeId,
                rule.MilestoneType ?? string.Empty,
                rule.EffectiveFrom ?? default,
                rule.CommissionRuleId,
                cancellationToken);
            if (hasConflict)
            {
                throw new ConflictException(
                    "Không thể kích hoạt vì đã có quy tắc hoa hồng đang hoạt động cho loại dịch vụ, mốc và thời điểm hiệu lực này.");
            }

            rule.IsActive = true;
            rule.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new(
            true,
            "Đã kích hoạt quy tắc hoa hồng.",
            new(rule.CommissionRuleId, rule.IsActive, rule.UpdatedAt));
    }
}
