using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Commission eligibility/calculation domain. PAYABLE means approved for payment; payment completion is represented by payout.status=COMPLETED.
/// </summary>
public partial class Commission
{
    public Guid CommissionId { get; set; }

    public Guid AttributionId { get; set; }

    public Guid PlacementId { get; set; }

    public Guid CommissionRuleId { get; set; }

    public string? MilestoneType { get; set; }

    public decimal? BaseAmount { get; set; }

    public decimal Amount { get; set; }

    /// <summary>
    /// Allowed Commission states. PAYABLE means approved for external/manual payment. payout.status=COMPLETED is payment source of truth.
    /// </summary>
    public string Status { get; set; } = null!;

    public Guid? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string RuleSnapshot { get; set; } = null!;

    public string CalculationSnapshot { get; set; } = null!;

    public DateTime? CalculatedAt { get; set; }

    public virtual AppUser? ApprovedByNavigation { get; set; }

    public virtual Attribution Attribution { get; set; } = null!;

    public virtual ICollection<CommissionAdjustment> CommissionAdjustments { get; set; } = new List<CommissionAdjustment>();

    public virtual CommissionRule CommissionRule { get; set; } = null!;

    public virtual ICollection<Dispute> Disputes { get; set; } = new List<Dispute>();

    public virtual CommissionMilestone? MilestoneTypeNavigation { get; set; }

    public virtual ICollection<Payout> Payouts { get; set; } = new List<Payout>();

    public virtual Placement Placement { get; set; } = null!;
}

