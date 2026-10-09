namespace HRConnect.Domain.Entities;

/// <summary>
/// One-time proof that a Candidate account owns an email previously used by
/// an unlinked Candidate profile. Token material is stored as a hash only.
/// </summary>
public partial class CandidateIdentityClaim
{
    public Guid ClaimId { get; set; }

    public Guid RequesterUserId { get; set; }

    public Guid RequesterCandidateId { get; set; }

    public Guid? TargetCandidateId { get; set; }

    public string AssertedEmail { get; set; } = null!;

    public string NormalizedEmail { get; set; } = null!;

    public string TokenHash { get; set; } = null!;

    public string Status { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public int AttemptCount { get; set; }

    public int ResendCount { get; set; }

    public DateTime? LastSentAt { get; set; }

    public DateTime? VerifiedAt { get; set; }

    public DateTime? CompletedAt { get; set; }

    public Guid? ReviewedBy { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewReason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public virtual AppUser RequesterUser { get; set; } = null!;

    public virtual Candidate RequesterCandidate { get; set; } = null!;

    public virtual Candidate? TargetCandidate { get; set; }

    public virtual AppUser? ReviewedByNavigation { get; set; }
}
