using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Post-application AI screening support. Match Score/Tier/Highlight support human review; AI does not auto-reject/shortlist/hire.
/// </summary>
public partial class AiMatchResult
{
    public Guid MatchResultId { get; set; }

    public Guid ApplicationId { get; set; }

    public int AttemptNo { get; set; }

    public decimal? MatchScore { get; set; }

    /// <summary>
    /// Semantic tier (for example HIGH/MEDIUM_HIGH/MEDIUM/LOW). UI color comes from match_tier_config; AI does not make the final hiring decision.
    /// </summary>
    public string? MatchTier { get; set; }

    public string? CandidateHighlight { get; set; }

    public string? MustHaveResult { get; set; }

    public string? ShouldHaveResult { get; set; }

    public string? RawResponse { get; set; }

    public string? ExternalReference { get; set; }

    public string Status { get; set; } = null!;

    public string? ErrorMessage { get; set; }

    public DateTime RequestedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public virtual Application Application { get; set; } = null!;

    public virtual MatchTierConfig? MatchTierNavigation { get; set; }
}

