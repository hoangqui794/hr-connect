using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class AffiliateProfile
{
    public Guid AffiliateId { get; set; }

    public Guid UserId { get; set; }

    public string AffiliateType { get; set; } = null!;

    public string? DisplayName { get; set; }

    public string? TaxInformation { get; set; }

    public string? ContactPerson { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string? BankName { get; set; }

    public string? BankAccountNumber { get; set; }

    public string? BankAccountHolder { get; set; }

    public string? BankBranch { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? VerifiedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<AffiliatePerformance> AffiliatePerformances { get; set; } = new List<AffiliatePerformance>();

    public virtual ICollection<Attribution> Attributions { get; set; } = new List<Attribution>();

    public virtual AppUser User { get; set; } = null!;
}

