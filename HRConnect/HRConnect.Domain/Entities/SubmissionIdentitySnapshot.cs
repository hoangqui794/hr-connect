namespace HRConnect.Domain.Entities;

/// <summary>Immutable, privacy-minimized identity evidence captured when a Submission is created.</summary>
public sealed class SubmissionIdentitySnapshot
{
    public Guid SubmissionId { get; set; }
    public string? NormalizedNameHash { get; set; }
    public string? EmailHmac { get; set; }
    public string? PhoneHmac { get; set; }
    public string? HmacKeyVersion { get; set; }
    public string? CvContentSha256 { get; set; }
    public string? CvTextFingerprint { get; set; }
    public string? FingerprintVersion { get; set; }
    public string AssertedContactSource { get; set; } = "AFFILIATE";
    public string VerificationLevel { get; set; } = "ASSERTED";
    public DateTime CapturedAt { get; set; }

    public Submission Submission { get; set; } = null!;
}
