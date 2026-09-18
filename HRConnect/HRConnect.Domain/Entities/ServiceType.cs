using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class ServiceType
{
    public Guid ServiceTypeId { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<CommissionRule> CommissionRules { get; set; } = new List<CommissionRule>();

    public virtual ICollection<Job> Jobs { get; set; } = new List<Job>();
}

