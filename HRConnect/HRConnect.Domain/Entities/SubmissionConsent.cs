namespace HRConnect.Domain.Entities;

/// <summary>
/// Candidate authorization for an affiliate-submitted CV. Tokens are stored only as SHA-256 hashes.
/// </summary>
public class SubmissionConsent
{
    public Guid ConsentId { get; set; }
    public Guid SubmissionId { get; set; }
    public string RecipientEmail { get; set; } = null!;
    public string TokenHash { get; set; } = null!;
    public string Status { get; set; } = null!;
    public DateTime RequestedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public string? ResponseIp { get; set; }
    public string? ResponseUserAgent { get; set; }
    public int EmailSendCount { get; set; }
    public DateTime? EmailSentAt { get; set; }
    public string? LastEmailError { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public virtual Submission Submission { get; set; } = null!;
}
