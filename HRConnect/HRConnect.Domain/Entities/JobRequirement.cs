using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class JobRequirement
{
    public Guid RequirementId { get; set; }

    public Guid JobId { get; set; }

    public string RequirementType { get; set; } = null!;

    public string? Category { get; set; }

    public string Content { get; set; } = null!;

    public decimal? Weight { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Job Job { get; set; } = null!;
}

