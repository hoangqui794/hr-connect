using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.CommissionRules.Common;

internal static class CommissionRuleAudit
{
    public const string EntityType = "COMMISSION_RULE";

    public static object Snapshot(CommissionRule rule) => new
    {
        serviceTypeId = rule.ServiceTypeId,
        name = rule.Name,
        milestoneType = rule.MilestoneType,
        rateType = rule.RateType,
        rateValue = rule.RateValue,
        warrantyRequired = rule.WarrantyRequired,
        effectiveFrom = rule.EffectiveFrom,
        effectiveTo = rule.EffectiveTo,
        isActive = rule.IsActive,
    };

    public static AuditEntry CreateEntry(string action, CommissionRule rule, object? oldValues, object? newValues) => new()
    {
        Action = action,
        EntityType = EntityType,
        EntityId = rule.CommissionRuleId,
        OldValues = oldValues,
        NewValues = newValues,
    };
}
