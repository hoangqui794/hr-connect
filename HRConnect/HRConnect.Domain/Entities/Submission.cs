using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Submission intake/audit record. A Submission referenced by Application/Attribution as the accepted winner cannot be invalidated or have its accepted identity/source snapshot changed.
/// </summary>
public partial class Submission
{
    public Guid SubmissionId { get; set; }

    public Guid CandidateId { get; set; }

    public Guid CvId { get; set; }

    public Guid JobId { get; set; }

    public Guid SubmittedBy { get; set; }

    public string Source { get; set; } = null!;

    public string Status { get; set; } = null!;

    public Guid? DuplicateOfSubmissionId { get; set; }

    public string? Note { get; set; }

    public DateTime SubmittedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<Application> Applications { get; set; } = new List<Application>();

    public virtual Attribution? Attribution { get; set; }

    public virtual Candidate Candidate { get; set; } = null!;

    public virtual CandidateCv CandidateCv { get; set; } = null!;

    public virtual ICollection<Dispute> Disputes { get; set; } = new List<Dispute>();

    public virtual Submission? DuplicateOfSubmission { get; set; }

    public virtual ICollection<Submission> InverseDuplicateOfSubmission { get; set; } = new List<Submission>();

    public virtual Job Job { get; set; } = null!;

    public virtual AppUser SubmittedByNavigation { get; set; } = null!;
}

