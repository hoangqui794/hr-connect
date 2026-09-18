using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

public partial class MatchTierConfig
{
    public string TierCode { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public decimal MinScore { get; set; }

    public decimal MaxScore { get; set; }

    public string ColorCode { get; set; } = null!;

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<AiMatchResult> AiMatchResults { get; set; } = new List<AiMatchResult>();

    public virtual ICollection<CandidateJobMatch> CandidateJobMatches { get; set; } = new List<CandidateJobMatch>();
}

