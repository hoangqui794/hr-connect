using System;

namespace HRConnect.Domain.Entities;

public partial class CandidateSavedJob
{
    public Guid CandidateSavedJobId { get; set; }

    public Guid CandidateId { get; set; }

    public Guid JobId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Candidate Candidate { get; set; } = null!;

    public virtual Job Job { get; set; } = null!;
}
