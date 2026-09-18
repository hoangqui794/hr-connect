using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE_RECRUITER role in the same transaction.
/// </summary>
public partial class AffiliateApplication
{
    public Guid AffiliateApplicationId { get; set; }

    public Guid UserId { get; set; }

    public string AffiliateType { get; set; } = null!;

    public string? DisplayName { get; set; }

    public string? TaxInformation { get; set; }

    public string? ContactPerson { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string SubmittedData { get; set; } = null!;

    public string Status { get; set; } = null!;

    public Guid? ReviewedBy { get; set; }

    public string? ReviewNote { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public virtual AppUser? ReviewedByNavigation { get; set; }

    public virtual AppUser User { get; set; } = null!;
}

