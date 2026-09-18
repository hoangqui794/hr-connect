using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// OPTIONAL D16 capability. Keep disabled/out of baseline if pre-application job-fit recommendation is not approved.
/// </summary>
public partial class CandidateJobMatch
{
    public Guid CandidateJobMatchId { get; set; }

    public Guid CandidateId { get; set; }

    public Guid JobId { get; set; }

    public Guid? CvId { get; set; }

    public int AttemptNo { get; set; }

    public decimal? MatchScore { get; set; }

    public string? MatchTier { get; set; }

    public string? MatchSummary { get; set; }

    public string? MatchingReasons { get; set; }

    public string? MissingRequirements { get; set; }

    public string Status { get; set; } = null!;

    public DateTime GeneratedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Candidate Candidate { get; set; } = null!;

    public virtual CandidateCv? CandidateCv { get; set; }

    public virtual Job Job { get; set; } = null!;

    public virtual MatchTierConfig? MatchTierNavigation { get; set; }
}

