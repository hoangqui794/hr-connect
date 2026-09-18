using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class Company
{
    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = null!;

    public string? TaxCode { get; set; }

    public string? Industry { get; set; }

    public string? CompanySize { get; set; }

    public string? Website { get; set; }

    public string? Address { get; set; }

    public string? Description { get; set; }

    public string VerificationStatus { get; set; } = null!;

    public DateTime? VerifiedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual CompanyUser? CompanyUser { get; set; }

    public virtual CompanyVerificationRequest? CompanyVerificationRequest { get; set; }

    public virtual ICollection<Job> Jobs { get; set; } = new List<Job>();
}

