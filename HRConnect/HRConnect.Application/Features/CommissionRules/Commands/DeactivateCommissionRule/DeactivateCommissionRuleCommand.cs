using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.CommissionRules.Common;
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
    private readonly IAuditLogService _auditLogService;

    public DeactivateCommissionRuleCommandHandler(
        ICommissionRuleRepository rules,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService)
    {
        _rules = rules;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<DeactivateCommissionRuleResponse> Handle(
        DeactivateCommissionRuleCommand request,
        CancellationToken cancellationToken)
    {
        var rule = await _rules.GetForUpdateAsync(request.CommissionRuleId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy quy tắc hoa hồng.");

        if (rule.IsActive)
        {
            var oldValues = CommissionRuleAudit.Snapshot(rule);
            rule.IsActive = false;
            rule.UpdatedAt = DateTime.UtcNow;
            await _auditLogService.AddAsync(
                CommissionRuleAudit.CreateEntry(
                    AuditActions.CommissionRuleDeactivated,
                    rule,
                    oldValues: oldValues,
                    newValues: CommissionRuleAudit.Snapshot(rule)),
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new(
            true,
            "Đã ngừng hiệu lực quy tắc hoa hồng.",
            new(rule.CommissionRuleId, rule.IsActive, rule.UpdatedAt));
    }
}
