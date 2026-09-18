using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Offer
{
    public Guid OfferId { get; set; }

    public Guid ApplicationId { get; set; }

    public int OfferVersion { get; set; }

    public decimal? Salary { get; set; }

    public string CurrencyCode { get; set; } = null!;

    public DateOnly? StartDate { get; set; }

    public DateOnly? ExpiryDate { get; set; }

    public string Status { get; set; } = null!;

    public Guid? CreatedBy { get; set; }

    public string? OfferDocumentUrl { get; set; }

    public DateTime? SentAt { get; set; }

    public DateTime? RespondedAt { get; set; }

    public string? DeclineReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Application Application { get; set; } = null!;

    public virtual AppUser? CreatedByNavigation { get; set; }

    public virtual ICollection<OfferApproval> OfferApprovals { get; set; } = new List<OfferApproval>();

    public virtual ICollection<Placement> Placements { get; set; } = new List<Placement>();
}

