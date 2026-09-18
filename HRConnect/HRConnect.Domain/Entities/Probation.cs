using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Probation
{
    public Guid ProbationId { get; set; }

    public Guid PlacementId { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public string? Result { get; set; }

    public string? Notes { get; set; }

    public Guid? UpdatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Placement Placement { get; set; } = null!;

    public virtual AppUser? UpdatedByNavigation { get; set; }
}

