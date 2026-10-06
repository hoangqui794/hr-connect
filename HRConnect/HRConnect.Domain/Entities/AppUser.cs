using System;
using System.Collections.Generic;

namespace HRConnect.Domain.Entities;

/// <summary>
/// One login identity. A user may simultaneously hold multiple roles through user_role. Candidate + Affiliate is supported on the same account.
/// </summary>
public partial class AppUser
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public string? DisplayName { get; set; }

    public string? Phone { get; set; }

    public string? NormalizedPhone { get; set; }

    public string? AvatarUrl { get; set; }

    public string Status { get; set; } = null!;

    public DateTime? EmailVerifiedAt { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public int FailedLoginAttempts { get; set; }

    public DateTime? LockoutEndAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual AdminProfile? AdminProfile { get; set; }

    public virtual ICollection<AffiliateApplication> AffiliateApplicationReviewedByNavigations { get; set; } = new List<AffiliateApplication>();

    public virtual AffiliateApplication? AffiliateApplicationUser { get; set; }

    public virtual AffiliateProfile? AffiliateProfile { get; set; }

    public virtual ICollection<ApplicationStatusHistory> ApplicationStatusHistories { get; set; } = new List<ApplicationStatusHistory>();

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual Candidate? Candidate { get; set; }

    public virtual ICollection<CommissionAdjustment> CommissionAdjustments { get; set; } = new List<CommissionAdjustment>();

    public virtual ICollection<Commission> Commissions { get; set; } = new List<Commission>();

    public virtual ICollection<CompanyUser> CompanyUsers { get; set; } = new List<CompanyUser>();

    public virtual ICollection<CompanyVerificationRequest> CompanyVerificationRequestReviewedByNavigations { get; set; } = new List<CompanyVerificationRequest>();

    public virtual ICollection<CompanyVerificationRequest> CompanyVerificationRequestSubmittedByNavigations { get; set; } = new List<CompanyVerificationRequest>();

    public virtual ICollection<Dispute> DisputeRaisedByNavigations { get; set; } = new List<Dispute>();

    public virtual ICollection<Dispute> DisputeResolvedByNavigations { get; set; } = new List<Dispute>();

    public virtual ICollection<EmailOutbox> EmailOutboxes { get; set; } = new List<EmailOutbox>();

    public virtual InternalHrProfile? InternalHrProfile { get; set; }

    public virtual ICollection<Interview> Interviews { get; set; } = new List<Interview>();

    public virtual ICollection<Interview> InterviewRecordedByNavigations { get; set; } = new List<Interview>();

    public virtual ICollection<InterviewParticipant> InterviewParticipants { get; set; } = new List<InterviewParticipant>();

    public virtual ICollection<InterviewStatusHistory> InterviewStatusHistories { get; set; } = new List<InterviewStatusHistory>();

    public virtual ICollection<JobStatusHistory> JobStatusHistories { get; set; } = new List<JobStatusHistory>();

    public virtual ICollection<Job> Jobs { get; set; } = new List<Job>();

    public virtual ICollection<Notification> Notifications { get; set; } = new List<Notification>();

    public virtual ICollection<OfferApproval> OfferApprovals { get; set; } = new List<OfferApproval>();

    public virtual ICollection<Offer> Offers { get; set; } = new List<Offer>();

    public virtual ICollection<Payout> Payouts { get; set; } = new List<Payout>();

    public virtual ICollection<Placement> Placements { get; set; } = new List<Placement>();

    public virtual ICollection<Probation> Probations { get; set; } = new List<Probation>();

    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();

    public virtual ICollection<Submission> Submissions { get; set; } = new List<Submission>();

    public virtual ICollection<UserRole> UserRoleAssignedByNavigations { get; set; } = new List<UserRole>();

    public virtual ICollection<UserRole> UserRoleRevokedByNavigations { get; set; } = new List<UserRole>();

    public virtual ICollection<UserRole> UserRoleUsers { get; set; } = new List<UserRole>();

    public virtual ICollection<UserToken> UserTokens { get; set; } = new List<UserToken>();

    public virtual ICollection<Warranty> Warranties { get; set; } = new List<Warranty>();
}

