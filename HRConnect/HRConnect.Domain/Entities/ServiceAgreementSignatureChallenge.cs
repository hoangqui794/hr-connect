using System;

namespace HRConnect.Domain.Entities;

/// <summary>
/// Thử thách ký thỏa thuận dịch vụ qua mã OTP gửi tới email của người đại diện Client (MF-01).
/// </summary>
public partial class ServiceAgreementSignatureChallenge
{
    public Guid ChallengeId { get; set; }

    public Guid ServiceAgreementId { get; set; }

    public Guid SignerUserId { get; set; }

    public string SignerEmailNormalized { get; set; } = null!;

    public string OtpHash { get; set; } = null!;

    public DateTime ExpiresAt { get; set; }

    public int AttemptCount { get; set; } = 0;

    public int MaxAttempts { get; set; } = 5;

    public bool IsConsumed { get; set; } = false;

    public DateTime? ConsumedAt { get; set; }

    public bool IsRevoked { get; set; } = false;

    public DateTime? RevokedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ServiceAgreement ServiceAgreement { get; set; } = null!;

    public virtual AppUser SignerUser { get; set; } = null!;
}
