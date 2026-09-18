using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// PROPOSED. Remove if the team does not implement a separate offer approval workflow.
/// </summary>
public partial class OfferApproval
{
    public Guid ApprovalId { get; set; }

    public Guid OfferId { get; set; }

    public Guid UserId { get; set; }

    public string? ApprovalType { get; set; }

    public string Status { get; set; } = null!;

    public string? Comment { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Offer Offer { get; set; } = null!;

    public virtual AppUser User { get; set; } = null!;
}

