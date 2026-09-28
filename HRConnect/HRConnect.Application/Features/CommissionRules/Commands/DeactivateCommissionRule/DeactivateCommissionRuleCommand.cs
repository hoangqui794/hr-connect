using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CommissionRules.Commands.DeactivateCommissionRule;

public sealed record DeactivateCommissionRuleCommand(Guid CommissionRuleId)
    : IRequest<DeactivateCommissionRuleResponse>;

public sealed record DeactivateCommissionRuleData(
    Guid CommissionRuleId,
    bool IsActive,
    DateTime UpdatedAt);

public sealed record DeactivateCommissionRuleResponse(
    bool Success,
    string Message,
    DeactivateCommissionRuleData Data);

public sealed class DeactivateCommissionRuleCommandHandler
    : IRequestHandler<DeactivateCommissionRuleCommand, DeactivateCommissionRuleResponse>
{
    private readonly ICommissionRuleRepository _rules;
    private readonly IUnitOfWork _unitOfWork;

    public DeactivateCommissionRuleCommandHandler(
        ICommissionRuleRepository rules,
        IUnitOfWork unitOfWork)
    {
        _rules = rules;
        _unitOfWork = unitOfWork;
    }

    public async Task<DeactivateCommissionRuleResponse> Handle(
        DeactivateCommissionRuleCommand request,
        CancellationToken cancellationToken)
    {
        var rule = await _rules.GetForUpdateAsync(request.CommissionRuleId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy quy tắc hoa hồng.");

        if (rule.IsActive)
        {
            rule.IsActive = false;
            rule.UpdatedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new(
            true,
            "Đã ngừng hiệu lực quy tắc hoa hồng.",
            new(rule.CommissionRuleId, rule.IsActive, rule.UpdatedAt));
    }
}
