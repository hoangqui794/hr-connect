using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Placement
{
    public Guid PlacementId { get; set; }

    public Guid ApplicationId { get; set; }

    public Guid OfferId { get; set; }

    public DateOnly ActualStartDate { get; set; }

    public string? Position { get; set; }

    public string? Department { get; set; }

    public string Status { get; set; } = null!;

    public Guid? ConfirmedBy { get; set; }

    public DateTime ConfirmedAt { get; set; }

    public string? ConfirmationNote { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Application Application { get; set; } = null!;

    public virtual AppUser? ConfirmedByNavigation { get; set; }

    public virtual ICollection<Commission> Commissions { get; set; } = new List<Commission>();

    public virtual Offer Offer { get; set; } = null!;

    public virtual Probation? Probation { get; set; }

    public virtual Warranty? Warranty { get; set; }
}

