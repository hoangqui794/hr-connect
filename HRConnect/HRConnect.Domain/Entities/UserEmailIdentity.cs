namespace HRConnect.Domain.Entities;

/// <summary>
/// An email address whose ownership has been verified for one account.
/// Only the PRIMARY identity is accepted for login and password recovery.
/// </summary>
public partial class UserEmailIdentity
{
    public Guid EmailIdentityId { get; set; }

    public Guid UserId { get; set; }

    public string Email { get; set; } = null!;

    public string NormalizedEmail { get; set; } = null!;

    public string Kind { get; set; } = null!;

    public string Status { get; set; } = null!;

    public string VerificationSource { get; set; } = null!;

    public DateTime? VerifiedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid ConcurrencyToken { get; set; }

    public virtual AppUser User { get; set; } = null!;
}
