using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Warranty exists only when applicable. No row may represent NOT_APPLICABLE; absence of a warranty row means not applicable.
/// </summary>
public partial class Warranty
{
    public Guid WarrantyId { get; set; }

    public Guid PlacementId { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public string Status { get; set; } = null!;

    public string? ResultNote { get; set; }

    public Guid? UpdatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Placement Placement { get; set; } = null!;

    public virtual AppUser? UpdatedByNavigation { get; set; }
}

