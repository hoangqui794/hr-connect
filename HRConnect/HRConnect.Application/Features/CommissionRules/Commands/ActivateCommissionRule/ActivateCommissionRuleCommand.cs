using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.CommissionRules.Common;
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
    private readonly IAuditLogService _auditLogService;

    public ActivateCommissionRuleCommandHandler(
        ICommissionRuleRepository rules,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService)
    {
        _rules = rules;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
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

            var oldValues = CommissionRuleAudit.Snapshot(rule);
            rule.IsActive = true;
            rule.UpdatedAt = DateTime.UtcNow;
            await _auditLogService.AddAsync(
                CommissionRuleAudit.CreateEntry(
                    AuditActions.CommissionRuleActivated,
                    rule,
                    oldValues: oldValues,
                    newValues: CommissionRuleAudit.Snapshot(rule)),
                cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new(
            true,
            "Đã kích hoạt quy tắc hoa hồng.",
            new(rule.CommissionRuleId, rule.IsActive, rule.UpdatedAt));
    }
}
