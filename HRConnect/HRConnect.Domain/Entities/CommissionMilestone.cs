using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class CommissionMilestone
{
    public string MilestoneCode { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<CommissionRule> CommissionRules { get; set; } = new List<CommissionRule>();

    public virtual ICollection<Commission> Commissions { get; set; } = new List<Commission>();
}

