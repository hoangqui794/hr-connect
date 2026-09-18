using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// First accepted Affiliate Submission attribution. Trigger validates source/status/Candidate/Job and blocks self-attribution by account/email/phone.
/// </summary>
public partial class Attribution
{
    public Guid AttributionId { get; set; }

    public Guid ApplicationId { get; set; }

    public Guid AffiliateId { get; set; }

    public Guid WinningSubmissionId { get; set; }

    public string AttributionRule { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime EstablishedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual AffiliateProfile Affiliate { get; set; } = null!;

    public virtual Application Application { get; set; } = null!;

    public virtual ICollection<Commission> Commissions { get; set; } = new List<Commission>();

    public virtual ICollection<Dispute> Disputes { get; set; } = new List<Dispute>();

    public virtual Submission WinningSubmission { get; set; } = null!;
}

