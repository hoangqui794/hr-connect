using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class CommissionRule
{
    public Guid CommissionRuleId { get; set; }

    public Guid ServiceTypeId { get; set; }

    public string Name { get; set; } = null!;

    public string? MilestoneType { get; set; }

    public string? RateType { get; set; }

    public decimal? RateValue { get; set; }

    public bool WarrantyRequired { get; set; }

    public DateTime? EffectiveFrom { get; set; }

    public DateTime? EffectiveTo { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Commission> Commissions { get; set; } = new List<Commission>();

    public virtual CommissionMilestone? MilestoneTypeNavigation { get; set; }

    public virtual ServiceType ServiceType { get; set; } = null!;
}

