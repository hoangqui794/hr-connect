using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class CompanyVerificationRequest
{
    public Guid CompanyVerificationRequestId { get; set; }

    public Guid CompanyId { get; set; }

    public Guid SubmittedBy { get; set; }

    public Guid? ReviewedBy { get; set; }

    public string Status { get; set; } = null!;

    public string SubmittedPayload { get; set; } = null!;

    public string? ReviewNote { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual AppUser? ReviewedByNavigation { get; set; }

    public virtual AppUser SubmittedByNavigation { get; set; } = null!;
}

