namespace HRConnect.Domain.Entities;

/// <summary>
/// Explainable, reviewable evidence that two Candidate records may represent the same person.
/// CandidateAId is always lexicographically smaller than CandidateBId.
/// </summary>
public sealed class CandidateDuplicateCase
{
    public Guid DuplicateCaseId { get; set; }
    public Guid CandidateAId { get; set; }
    public Guid CandidateBId { get; set; }
    public Guid? SubmissionId { get; set; }
    public Guid? JobId { get; set; }
    public string RiskLevel { get; set; } = "REVIEW";
    public string Status { get; set; } = "OPEN";
    public string? Resolution { get; set; }
    public string? ResolutionReason { get; set; }
    public Guid? CanonicalCandidateId { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid ConcurrencyToken { get; set; } = Guid.NewGuid();
    public string IdempotencyKey { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public Candidate CandidateA { get; set; } = null!;
    public Candidate CandidateB { get; set; } = null!;
    public Candidate? CanonicalCandidate { get; set; }
    public Submission? Submission { get; set; }
    public Job? Job { get; set; }
    public AppUser? Reviewer { get; set; }
    public ICollection<CandidateDuplicateSignal> Signals { get; set; } = new List<CandidateDuplicateSignal>();
    public ICollection<Dispute> Disputes { get; set; } = new List<Dispute>();
}
