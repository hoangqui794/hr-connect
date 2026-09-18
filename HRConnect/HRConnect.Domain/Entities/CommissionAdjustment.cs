using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Append-only Commission adjustment event. UPDATE/DELETE are prohibited; corrections require a new adjustment event.
/// </summary>
public partial class CommissionAdjustment
{
    public Guid CommissionAdjustmentId { get; set; }

    public Guid CommissionId { get; set; }

    public decimal OldAmount { get; set; }

    public decimal NewAmount { get; set; }

    public string Reason { get; set; } = null!;

    public Guid AdjustedBy { get; set; }

    public DateTime AdjustedAt { get; set; }

    public virtual AppUser AdjustedByNavigation { get; set; } = null!;

    public virtual Commission Commission { get; set; } = null!;
}

