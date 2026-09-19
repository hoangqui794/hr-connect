using System;
using System.Collections.Generic;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Persistence;

public partial class ApplicationDbContext : DbContext
{
    public ApplicationDbContext()
    {
    }

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AdminProfile> AdminProfiles { get; set; }

    public virtual DbSet<AffiliateApplication> AffiliateApplications { get; set; }

    public virtual DbSet<AffiliatePerformance> AffiliatePerformances { get; set; }

    public virtual DbSet<AffiliateProfile> AffiliateProfiles { get; set; }

    public virtual DbSet<AiMatchResult> AiMatchResults { get; set; }

    public virtual DbSet<AppUser> AppUsers { get; set; }

    public virtual DbSet<HRConnect.Domain.Entities.Application> Applications { get; set; }

    public virtual DbSet<ApplicationStatusHistory> ApplicationStatusHistories { get; set; }

    public virtual DbSet<Attribution> Attributions { get; set; }

    public virtual DbSet<AuditLog> AuditLogs { get; set; }

    public virtual DbSet<Candidate> Candidates { get; set; }

    public virtual DbSet<CandidateCv> CandidateCvs { get; set; }

    public virtual DbSet<CandidateJobMatch> CandidateJobMatches { get; set; }

    public virtual DbSet<CandidateSkill> CandidateSkills { get; set; }

    public virtual DbSet<Commission> Commissions { get; set; }

    public virtual DbSet<CommissionAdjustment> CommissionAdjustments { get; set; }

    public virtual DbSet<CommissionMilestone> CommissionMilestones { get; set; }

    public virtual DbSet<CommissionRule> CommissionRules { get; set; }

    public virtual DbSet<Company> Companies { get; set; }

    public virtual DbSet<CompanyUser> CompanyUsers { get; set; }

    public virtual DbSet<CompanyVerificationRequest> CompanyVerificationRequests { get; set; }

    public virtual DbSet<CvTemplate> CvTemplates { get; set; }

    public virtual DbSet<Dispute> Disputes { get; set; }

    public virtual DbSet<EmailOutbox> EmailOutboxes { get; set; }

    public virtual DbSet<InternalHrProfile> InternalHrProfiles { get; set; }

    public virtual DbSet<Interview> Interviews { get; set; }

    public virtual DbSet<InterviewStatusHistory> InterviewStatusHistories { get; set; }

    public virtual DbSet<Job> Jobs { get; set; }

    public virtual DbSet<JobRequirement> JobRequirements { get; set; }

    public virtual DbSet<JobSkill> JobSkills { get; set; }

    public virtual DbSet<JobStatusHistory> JobStatusHistories { get; set; }

    public virtual DbSet<MatchTierConfig> MatchTierConfigs { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<Offer> Offers { get; set; }

    public virtual DbSet<OfferApproval> OfferApprovals { get; set; }

    public virtual DbSet<Payout> Payouts { get; set; }

    public virtual DbSet<Permission> Permissions { get; set; }

    public virtual DbSet<Placement> Placements { get; set; }

    public virtual DbSet<Probation> Probations { get; set; }

    public virtual DbSet<RefreshToken> RefreshTokens { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<RolePermission> RolePermissions { get; set; }

    public virtual DbSet<ServiceType> ServiceTypes { get; set; }

    public virtual DbSet<Skill> Skills { get; set; }

    public virtual DbSet<Submission> Submissions { get; set; }

    public virtual DbSet<UserRole> UserRoles { get; set; }

    public virtual DbSet<UserToken> UserTokens { get; set; }

    public virtual DbSet<Warranty> Warranties { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // Connection string is configured via Dependency Injection (Program.cs / DependencyInjection.cs)
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pgcrypto");
        modelBuilder.HasSequence<long>("audit_log_audit_log_id_seq", "public");

        modelBuilder.Entity<AdminProfile>(entity =>
        {
            entity.HasKey(e => e.AdminProfileId).HasName("admin_profile_pkey");

            entity.ToTable("admin_profile", "public");

            entity.HasIndex(e => e.EmployeeCode, "admin_profile_employee_code_key").IsUnique();

            entity.HasIndex(e => e.UserId, "admin_profile_user_id_key").IsUnique();

            entity.Property(e => e.AdminProfileId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("admin_profile_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EmployeeCode)
                .HasMaxLength(50)
                .HasColumnName("employee_code");
            entity.Property(e => e.JobTitle)
                .HasMaxLength(120)
                .HasColumnName("job_title");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithOne(p => p.AdminProfile)
                .HasForeignKey<AdminProfile>(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("admin_profile_user_id_fkey");
        });

        modelBuilder.Entity<AffiliateApplication>(entity =>
        {
            entity.HasKey(e => e.AffiliateApplicationId).HasName("affiliate_application_pkey");

            entity.ToTable("affiliate_application", "public", tb => tb.HasComment("Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE_RECRUITER role in the same transaction."));

            entity.HasIndex(e => e.UserId, "uq_affiliate_application_open")
                .IsUnique()
                .HasFilter("((status)::text = ANY ((ARRAY['PENDING'::character varying, 'UNDER_REVIEW'::character varying])::text[]))");

            entity.Property(e => e.AffiliateApplicationId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("affiliate_application_id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.AffiliateType)
                .HasMaxLength(50)
                .HasDefaultValueSql("'RECRUITER'::character varying")
                .HasColumnName("affiliate_type");
            entity.Property(e => e.ContactPerson)
                .HasMaxLength(180)
                .HasColumnName("contact_person");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(180)
                .HasColumnName("display_name");
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasColumnName("phone");
            entity.Property(e => e.ReviewNote).HasColumnName("review_note");
            entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("submitted_at");
            entity.Property(e => e.SubmittedData)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("submitted_data");
            entity.Property(e => e.TaxInformation)
                .HasMaxLength(255)
                .HasColumnName("tax_information");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.ReviewedByNavigation).WithMany(p => p.AffiliateApplicationReviewedByNavigations)
                .HasForeignKey(d => d.ReviewedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("affiliate_application_reviewed_by_fkey");

            entity.HasOne(d => d.User).WithOne(p => p.AffiliateApplicationUser)
                .HasForeignKey<AffiliateApplication>(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("affiliate_application_user_id_fkey");
        });

        modelBuilder.Entity<AffiliatePerformance>(entity =>
        {
            entity.HasKey(e => e.AffiliatePerformanceId).HasName("affiliate_performance_pkey");

            entity.ToTable("affiliate_performance", "public", tb => tb.HasComment("D17-ready performance snapshot. submission_to_hire_rate is supported; quality_rating stays nullable until the rating formula is approved."));

            entity.HasIndex(e => new { e.AffiliateId, e.PeriodStart, e.PeriodEnd }, "affiliate_performance_affiliate_id_period_start_period_end_key").IsUnique();

            entity.HasIndex(e => new { e.AffiliateId, e.PeriodEnd }, "idx_affiliate_performance_affiliate_period").IsDescending(false, true);

            entity.Property(e => e.AffiliatePerformanceId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("affiliate_performance_id");
            entity.Property(e => e.AffiliateId).HasColumnName("affiliate_id");
            entity.Property(e => e.CalculatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("calculated_at");
            entity.Property(e => e.CalculationVersion)
                .HasMaxLength(50)
                .HasColumnName("calculation_version");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.PeriodEnd).HasColumnName("period_end");
            entity.Property(e => e.PeriodStart).HasColumnName("period_start");
            entity.Property(e => e.QualityRating)
                .HasPrecision(7, 4)
                .HasColumnName("quality_rating");
            entity.Property(e => e.RatingLabel)
                .HasMaxLength(50)
                .HasColumnName("rating_label");
            entity.Property(e => e.SubmissionToHireRate)
                .HasPrecision(7, 4)
                .HasColumnName("submission_to_hire_rate");
            entity.Property(e => e.TotalInterviews)
                .HasDefaultValue(0)
                .HasColumnName("total_interviews");
            entity.Property(e => e.TotalPlacements)
                .HasDefaultValue(0)
                .HasColumnName("total_placements");
            entity.Property(e => e.TotalShortlisted)
                .HasDefaultValue(0)
                .HasColumnName("total_shortlisted");
            entity.Property(e => e.TotalSubmissions)
                .HasDefaultValue(0)
                .HasColumnName("total_submissions");

            entity.HasOne(d => d.Affiliate).WithMany(p => p.AffiliatePerformances)
                .HasForeignKey(d => d.AffiliateId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("affiliate_performance_affiliate_id_fkey");
        });

        modelBuilder.Entity<AffiliateProfile>(entity =>
        {
            entity.HasKey(e => e.AffiliateId).HasName("affiliate_profile_pkey");

            entity.ToTable("affiliate_profile", "public");

            entity.HasIndex(e => e.UserId, "affiliate_profile_user_id_key").IsUnique();

            entity.Property(e => e.AffiliateId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("affiliate_id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.AffiliateType)
                .HasMaxLength(50)
                .HasDefaultValueSql("'RECRUITER'::character varying")
                .HasColumnName("affiliate_type");
            entity.Property(e => e.ContactPerson)
                .HasMaxLength(180)
                .HasColumnName("contact_person");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(180)
                .HasColumnName("display_name");
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasColumnName("phone");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.TaxInformation)
                .HasMaxLength(255)
                .HasColumnName("tax_information");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.VerifiedAt).HasColumnName("verified_at");

            entity.HasOne(d => d.User).WithOne(p => p.AffiliateProfile)
                .HasForeignKey<AffiliateProfile>(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("affiliate_profile_user_id_fkey");
        });

        modelBuilder.Entity<AiMatchResult>(entity =>
        {
            entity.HasKey(e => e.MatchResultId).HasName("ai_match_result_pkey");

            entity.ToTable("ai_match_result", "public", tb => tb.HasComment("Post-application AI screening support. Match Score/Tier/Highlight support human review; AI does not auto-reject/shortlist/hire."));

            entity.HasIndex(e => new { e.ApplicationId, e.AttemptNo }, "ai_match_result_application_id_attempt_no_key").IsUnique();

            entity.HasIndex(e => new { e.ApplicationId, e.AttemptNo }, "idx_ai_match_application").IsDescending(false, true);

            entity.Property(e => e.MatchResultId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("match_result_id");
            entity.Property(e => e.ApplicationId).HasColumnName("application_id");
            entity.Property(e => e.AttemptNo)
                .HasDefaultValue(1)
                .HasColumnName("attempt_no");
            entity.Property(e => e.CandidateHighlight)
                .HasColumnType("jsonb")
                .HasColumnName("candidate_highlight");
            entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
            entity.Property(e => e.ErrorMessage).HasColumnName("error_message");
            entity.Property(e => e.ExternalReference)
                .HasMaxLength(255)
                .HasColumnName("external_reference");
            entity.Property(e => e.MatchScore)
                .HasPrecision(5, 2)
                .HasColumnName("match_score");
            entity.Property(e => e.MatchTier)
                .HasMaxLength(30)
                .HasComment("Semantic tier (for example HIGH/MEDIUM_HIGH/MEDIUM/LOW). UI color comes from match_tier_config; AI does not make the final hiring decision.")
                .HasColumnName("match_tier");
            entity.Property(e => e.MustHaveResult)
                .HasColumnType("jsonb")
                .HasColumnName("must_have_result");
            entity.Property(e => e.RawResponse)
                .HasColumnType("jsonb")
                .HasColumnName("raw_response");
            entity.Property(e => e.RequestedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("requested_at");
            entity.Property(e => e.ShouldHaveResult)
                .HasColumnType("jsonb")
                .HasColumnName("should_have_result");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("status");

            entity.HasOne(d => d.Application).WithMany(p => p.AiMatchResults)
                .HasForeignKey(d => d.ApplicationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("ai_match_result_application_id_fkey");

            entity.HasOne(d => d.MatchTierNavigation).WithMany(p => p.AiMatchResults)
                .HasForeignKey(d => d.MatchTier)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_ai_match_result_tier");
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("app_user_pkey");

            entity.ToTable("app_user", "public", tb => tb.HasComment("One login identity. A user may simultaneously hold multiple roles through user_role. Candidate + Affiliate is supported on the same account."));

            entity.HasIndex(e => e.NormalizedPhone, "idx_app_user_normalized_phone").HasFilter("(normalized_phone IS NOT NULL)");

            entity.HasIndex(e => e.Status, "idx_app_user_status");

            entity.Property(e => e.UserId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("user_id");
            entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(255)
                .HasColumnName("display_name");
            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .HasColumnName("email");
            entity.Property(e => e.EmailVerifiedAt).HasColumnName("email_verified_at");
            entity.Property(e => e.LastLoginAt).HasColumnName("last_login_at");
            entity.Property(e => e.NormalizedPhone)
                .HasMaxLength(30)
                .HasColumnName("normalized_phone");
            entity.Property(e => e.PasswordHash)
                .HasMaxLength(255)
                .HasColumnName("password_hash");
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasColumnName("phone");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<HRConnect.Domain.Entities.Application>(entity =>
        {
            entity.HasKey(e => e.ApplicationId).HasName("application_pkey");

            entity.ToTable("application", "public", t => 
            {
                t.HasCheckConstraint("ck_application_status", "status IN ('SUBMITTED','SCREENING','SHORTLISTED','REJECTED','INTERVIEW','BACKUP','BACKUP_NOT_SELECTED','INTERVIEW_FAILED','OFFER_PENDING','OFFER_ACCEPTED','OFFER_DECLINED','NOT_STARTED','WITHDRAWN','PLACED','CLOSED')");
            });

            entity.HasIndex(e => new { e.CandidateId, e.JobId }, "application_candidate_id_job_id_key").IsUnique();

            entity.HasIndex(e => new { e.CandidateId, e.UpdatedAt }, "idx_application_candidate").IsDescending(false, true);

            entity.HasIndex(e => new { e.JobId, e.Status }, "idx_application_job_status");

            entity.Property(e => e.ApplicationId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("application_id");
            entity.Property(e => e.AcceptedSubmissionId).HasColumnName("accepted_submission_id");
            entity.Property(e => e.AppliedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("applied_at");
            entity.Property(e => e.CandidateId).HasColumnName("candidate_id");
            entity.Property(e => e.CurrentStage)
                .HasMaxLength(50)
                .HasColumnName("current_stage");
            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.Status)
                .HasMaxLength(40)
                .HasDefaultValueSql("'SUBMITTED'::character varying")
                .HasComment("Allowed Application states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.")
                .HasColumnName("status");
            entity.Property(e => e.StatusReason).HasColumnName("status_reason");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Candidate).WithMany(p => p.Applications)
                .HasForeignKey(d => d.CandidateId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("application_candidate_id_fkey");

            entity.HasOne(d => d.Job).WithMany(p => p.Applications)
                .HasForeignKey(d => d.JobId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("application_job_id_fkey");

            entity.HasOne(d => d.Submission).WithMany(p => p.Applications)
                .HasPrincipalKey(p => new { p.SubmissionId, p.CandidateId, p.JobId })
                .HasForeignKey(d => new { d.AcceptedSubmissionId, d.CandidateId, d.JobId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_application_accepted_submission");
        });

        modelBuilder.Entity<ApplicationStatusHistory>(entity =>
        {
            entity.HasKey(e => e.ApplicationStatusHistoryId).HasName("application_status_history_pkey");

            entity.ToTable("application_status_history", "public");

            entity.HasIndex(e => new { e.ApplicationId, e.ChangedAt }, "idx_application_status_history_app").IsDescending(false, true);

            entity.Property(e => e.ApplicationStatusHistoryId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("application_status_history_id");
            entity.Property(e => e.ApplicationId).HasColumnName("application_id");
            entity.Property(e => e.ChangedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("changed_at");
            entity.Property(e => e.ChangedBy).HasColumnName("changed_by");
            entity.Property(e => e.NewStatus)
                .HasMaxLength(40)
                .HasColumnName("new_status");
            entity.Property(e => e.OldStatus)
                .HasMaxLength(40)
                .HasColumnName("old_status");
            entity.Property(e => e.Reason).HasColumnName("reason");

            entity.HasOne(d => d.Application).WithMany(p => p.ApplicationStatusHistories)
                .HasForeignKey(d => d.ApplicationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("application_status_history_application_id_fkey");

            entity.HasOne(d => d.ChangedByNavigation).WithMany(p => p.ApplicationStatusHistories)
                .HasForeignKey(d => d.ChangedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("application_status_history_changed_by_fkey");
        });

        modelBuilder.Entity<Attribution>(entity =>
        {
            entity.HasKey(e => e.AttributionId).HasName("attribution_pkey");

            entity.ToTable("attribution", "public", tb => tb.HasComment("First accepted Affiliate Submission attribution. Trigger validates source/status/Candidate/Job and blocks self-attribution by account/email/phone."));

            entity.HasIndex(e => e.ApplicationId, "attribution_application_id_key").IsUnique();

            entity.HasIndex(e => e.WinningSubmissionId, "attribution_winning_submission_id_key").IsUnique();

            entity.Property(e => e.AttributionId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("attribution_id");
            entity.Property(e => e.AffiliateId).HasColumnName("affiliate_id");
            entity.Property(e => e.ApplicationId).HasColumnName("application_id");
            entity.Property(e => e.AttributionRule)
                .HasMaxLength(100)
                .HasDefaultValueSql("'FIRST_SUBMISSION_TIMESTAMP_PRECEDENCE'::character varying")
                .HasColumnName("attribution_rule");
            entity.Property(e => e.EstablishedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("established_at");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.WinningSubmissionId).HasColumnName("winning_submission_id");

            entity.HasOne(d => d.Affiliate).WithMany(p => p.Attributions)
                .HasForeignKey(d => d.AffiliateId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("attribution_affiliate_id_fkey");

            entity.HasOne(d => d.Application).WithOne(p => p.Attribution)
                .HasForeignKey<Attribution>(d => d.ApplicationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("attribution_application_id_fkey");

            entity.HasOne(d => d.WinningSubmission).WithOne(p => p.Attribution)
                .HasForeignKey<Attribution>(d => d.WinningSubmissionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("attribution_winning_submission_id_fkey");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.AuditLogId).HasName("audit_log_pkey");

            entity.ToTable("audit_log", "public", tb => tb.HasComment("Append-only audit trail. Set hr_connect.current_user_id in the application transaction when actor identity is available."));

            entity.HasIndex(e => new { e.ActorUserId, e.CreatedAt }, "idx_audit_log_actor").IsDescending(false, true);

            entity.HasIndex(e => new { e.EntityType, e.EntityId, e.CreatedAt }, "idx_audit_log_entity").IsDescending(false, false, true);

            entity.Property(e => e.AuditLogId)
                .HasDefaultValueSql("nextval('audit_log_audit_log_id_seq'::regclass)")
                .HasColumnName("audit_log_id");
            entity.Property(e => e.Action)
                .HasMaxLength(120)
                .HasColumnName("action");
            entity.Property(e => e.ActorUserId).HasColumnName("actor_user_id");
            entity.Property(e => e.CorrelationId).HasColumnName("correlation_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EntityId).HasColumnName("entity_id");
            entity.Property(e => e.EntityType)
                .HasMaxLength(80)
                .HasColumnName("entity_type");
            entity.Property(e => e.IpAddress).HasColumnName("ip_address");
            entity.Property(e => e.NewValues)
                .HasColumnType("jsonb")
                .HasColumnName("new_values");
            entity.Property(e => e.OldValues)
                .HasColumnType("jsonb")
                .HasColumnName("old_values");
            entity.Property(e => e.UserAgent).HasColumnName("user_agent");

            entity.HasOne(d => d.ActorUser).WithMany(p => p.AuditLogs)
                .HasForeignKey(d => d.ActorUserId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("audit_log_actor_user_id_fkey");
        });

        modelBuilder.Entity<Candidate>(entity =>
        {
            entity.HasKey(e => e.CandidateId).HasName("candidate_pkey");

            entity.ToTable("candidate", "public");

            entity.HasIndex(e => e.UserId, "candidate_user_id_key").IsUnique();

            entity.HasIndex(e => e.Status, "idx_candidate_status");

            entity.HasIndex(e => e.NormalizedEmail, "uq_candidate_identity_email")
                .IsUnique()
                .HasFilter("((normalized_email IS NOT NULL) AND ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))");

            entity.HasIndex(e => e.NormalizedPhone, "uq_candidate_identity_phone")
                .IsUnique()
                .HasFilter("((normalized_phone IS NOT NULL) AND ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))");

            entity.Property(e => e.CandidateId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("candidate_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CurrentAddress).HasColumnName("current_address");
            entity.Property(e => e.DateOfBirth).HasColumnName("date_of_birth");
            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .HasColumnName("email");
            entity.Property(e => e.FullName)
                .HasMaxLength(255)
                .HasColumnName("full_name");
            entity.Property(e => e.Gender)
                .HasMaxLength(30)
                .HasColumnName("gender");
            entity.Property(e => e.HighestEducation)
                .HasMaxLength(120)
                .HasColumnName("highest_education");
            entity.Property(e => e.MergedIntoCandidateId)
                .HasComment("Canonical ACTIVE Candidate that owns the merged identity. Merge cycles and non-ACTIVE targets are rejected.")
                .HasColumnName("merged_into_candidate_id");
            entity.Property(e => e.NormalizedEmail)
                .HasMaxLength(255)
                .HasColumnName("normalized_email");
            entity.Property(e => e.NormalizedPhone)
                .HasMaxLength(30)
                .HasColumnName("normalized_phone");
            entity.Property(e => e.Phone)
                .HasMaxLength(30)
                .HasColumnName("phone");
            entity.Property(e => e.ProfileVisibility)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PRIVATE'::character varying")
                .HasColumnName("profile_visibility");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.Summary).HasColumnName("summary");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.YearsOfExperience)
                .HasPrecision(5, 2)
                .HasColumnName("years_of_experience");

            entity.HasOne(d => d.MergedIntoCandidate).WithMany(p => p.InverseMergedIntoCandidate)
                .HasForeignKey(d => d.MergedIntoCandidateId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_candidate_merged_into");

            entity.HasOne(d => d.User).WithOne(p => p.Candidate)
                .HasForeignKey<Candidate>(d => d.UserId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("candidate_user_id_fkey");
        });

        modelBuilder.Entity<CandidateCv>(entity =>
        {
            entity.HasKey(e => e.CvId).HasName("candidate_cv_pkey");

            entity.ToTable("candidate_cv", "public", tb => tb.HasComment("Supports PLATFORM_BUILDER, TEMPLATE_FORM and FILE_UPLOAD CV creation methods."));

            entity.HasIndex(e => new { e.CandidateId, e.CreatedAt }, "idx_candidate_cv_candidate").IsDescending(false, true);

            entity.HasIndex(e => new { e.CreationMethod, e.Status }, "idx_candidate_cv_creation_method");

            entity.HasIndex(e => new { e.CandidateId, e.CvId }, "uq_candidate_cv_owner").IsUnique();

            entity.HasIndex(e => e.CandidateId, "uq_candidate_primary_cv")
                .IsUnique()
                .HasFilter("((is_primary = true) AND ((status)::text = 'ACTIVE'::text))");

            entity.Property(e => e.CvId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("cv_id");
            entity.Property(e => e.CandidateId).HasColumnName("candidate_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreationMethod)
                .HasMaxLength(40)
                .HasColumnName("creation_method");
            entity.Property(e => e.CvTemplateId).HasColumnName("cv_template_id");
            entity.Property(e => e.FileName)
                .HasMaxLength(255)
                .HasColumnName("file_name");
            entity.Property(e => e.FileSizeBytes).HasColumnName("file_size_bytes");
            entity.Property(e => e.IsPrimary)
                .HasDefaultValue(false)
                .HasColumnName("is_primary");
            entity.Property(e => e.MimeType)
                .HasMaxLength(120)
                .HasColumnName("mime_type");
            entity.Property(e => e.ParsedData)
                .HasColumnType("jsonb")
                .HasColumnName("parsed_data");
            entity.Property(e => e.RenderedFileUrl).HasColumnName("rendered_file_url");
            entity.Property(e => e.SourceFileUrl).HasColumnName("source_file_url");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.StructuredContent)
                .HasColumnType("jsonb")
                .HasColumnName("structured_content");
            entity.Property(e => e.Title)
                .HasMaxLength(180)
                .HasColumnName("title");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Candidate).WithOne(p => p.CandidateCv)
                .HasForeignKey<CandidateCv>(d => d.CandidateId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("candidate_cv_candidate_id_fkey");

            entity.HasOne(d => d.CvTemplate).WithMany(p => p.CandidateCvs)
                .HasForeignKey(d => d.CvTemplateId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("candidate_cv_cv_template_id_fkey");
        });

        modelBuilder.Entity<CandidateJobMatch>(entity =>
        {
            entity.HasKey(e => e.CandidateJobMatchId).HasName("candidate_job_match_pkey");

            entity.ToTable("candidate_job_match", "public", tb => tb.HasComment("OPTIONAL D16 capability. Keep disabled/out of baseline if pre-application job-fit recommendation is not approved."));

            entity.HasIndex(e => new { e.CandidateId, e.JobId, e.AttemptNo }, "candidate_job_match_candidate_id_job_id_attempt_no_key").IsUnique();

            entity.HasIndex(e => new { e.CandidateId, e.MatchScore, e.GeneratedAt }, "idx_candidate_job_match_candidate_score").IsDescending(false, true, true);

            entity.HasIndex(e => new { e.JobId, e.GeneratedAt }, "idx_candidate_job_match_job").IsDescending(false, true);

            entity.Property(e => e.CandidateJobMatchId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("candidate_job_match_id");
            entity.Property(e => e.AttemptNo)
                .HasDefaultValue(1)
                .HasColumnName("attempt_no");
            entity.Property(e => e.CandidateId).HasColumnName("candidate_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CvId).HasColumnName("cv_id");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.GeneratedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("generated_at");
            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.MatchScore)
                .HasPrecision(5, 2)
                .HasColumnName("match_score");
            entity.Property(e => e.MatchSummary)
                .HasColumnType("jsonb")
                .HasColumnName("match_summary");
            entity.Property(e => e.MatchTier)
                .HasMaxLength(30)
                .HasColumnName("match_tier");
            entity.Property(e => e.MatchingReasons)
                .HasColumnType("jsonb")
                .HasColumnName("matching_reasons");
            entity.Property(e => e.MissingRequirements)
                .HasColumnType("jsonb")
                .HasColumnName("missing_requirements");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'GENERATED'::character varying")
                .HasColumnName("status");

            entity.HasOne(d => d.Candidate).WithMany(p => p.CandidateJobMatches)
                .HasForeignKey(d => d.CandidateId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("candidate_job_match_candidate_id_fkey");

            entity.HasOne(d => d.Job).WithMany(p => p.CandidateJobMatches)
                .HasForeignKey(d => d.JobId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("candidate_job_match_job_id_fkey");

            entity.HasOne(d => d.MatchTierNavigation).WithMany(p => p.CandidateJobMatches)
                .HasForeignKey(d => d.MatchTier)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_candidate_job_match_tier");

            entity.HasOne(d => d.CandidateCv).WithMany(p => p.CandidateJobMatches)
                .HasPrincipalKey(p => new { p.CandidateId, p.CvId })
                .HasForeignKey(d => new { d.CandidateId, d.CvId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_candidate_job_match_cv_owner");
        });

        modelBuilder.Entity<CandidateSkill>(entity =>
        {
            entity.HasKey(e => new { e.CandidateId, e.SkillId }).HasName("candidate_skill_pkey");

            entity.ToTable("candidate_skill", "public");

            entity.Property(e => e.CandidateId).HasColumnName("candidate_id");
            entity.Property(e => e.SkillId).HasColumnName("skill_id");
            entity.Property(e => e.ProficiencyLevel)
                .HasMaxLength(40)
                .HasColumnName("proficiency_level");
            entity.Property(e => e.YearsOfExperience)
                .HasPrecision(5, 2)
                .HasColumnName("years_of_experience");

            entity.HasOne(d => d.Candidate).WithMany(p => p.CandidateSkills)
                .HasForeignKey(d => d.CandidateId)
                .HasConstraintName("candidate_skill_candidate_id_fkey");

            entity.HasOne(d => d.Skill).WithMany(p => p.CandidateSkills)
                .HasForeignKey(d => d.SkillId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("candidate_skill_skill_id_fkey");
        });

        modelBuilder.Entity<Commission>(entity =>
        {
            entity.HasKey(e => e.CommissionId).HasName("commission_pkey");

            entity.ToTable("commission", "public", tb => tb.HasComment("Commission eligibility/calculation domain. PAYABLE means approved for payment; payment completion is represented by payout.status=COMPLETED."));

            entity.HasIndex(e => new { e.Status, e.CreatedAt }, "idx_commission_status").IsDescending(false, true);

            entity.HasIndex(e => new { e.AttributionId, e.PlacementId }, "uq_commission_attribution_placement").IsUnique();

            entity.Property(e => e.CommissionId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("commission_id");
            entity.Property(e => e.Amount)
                .HasPrecision(18, 2)
                .HasColumnName("amount");
            entity.Property(e => e.ApprovedAt).HasColumnName("approved_at");
            entity.Property(e => e.ApprovedBy).HasColumnName("approved_by");
            entity.Property(e => e.AttributionId).HasColumnName("attribution_id");
            entity.Property(e => e.BaseAmount)
                .HasPrecision(18, 2)
                .HasColumnName("base_amount");
            entity.Property(e => e.CalculatedAt).HasColumnName("calculated_at");
            entity.Property(e => e.CalculationSnapshot)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("calculation_snapshot");
            entity.Property(e => e.CommissionRuleId).HasColumnName("commission_rule_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.MilestoneType)
                .HasMaxLength(60)
                .HasColumnName("milestone_type");
            entity.Property(e => e.PlacementId).HasColumnName("placement_id");
            entity.Property(e => e.RuleSnapshot)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("rule_snapshot");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasComment("Allowed Commission states. PAYABLE means approved for external/manual payment. payout.status=COMPLETED is payment source of truth.")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.Commissions)
                .HasForeignKey(d => d.ApprovedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("commission_approved_by_fkey");

            entity.HasOne(d => d.Attribution).WithMany(p => p.Commissions)
                .HasForeignKey(d => d.AttributionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("commission_attribution_id_fkey");

            entity.HasOne(d => d.CommissionRule).WithMany(p => p.Commissions)
                .HasForeignKey(d => d.CommissionRuleId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("commission_commission_rule_id_fkey");

            entity.HasOne(d => d.MilestoneTypeNavigation).WithMany(p => p.Commissions)
                .HasForeignKey(d => d.MilestoneType)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_commission_milestone");

            entity.HasOne(d => d.Placement).WithMany(p => p.Commissions)
                .HasForeignKey(d => d.PlacementId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("commission_placement_id_fkey");
        });

        modelBuilder.Entity<CommissionAdjustment>(entity =>
        {
            entity.HasKey(e => e.CommissionAdjustmentId).HasName("commission_adjustment_pkey");

            entity.ToTable("commission_adjustment", "public", tb => tb.HasComment("Append-only Commission adjustment event. UPDATE/DELETE are prohibited; corrections require a new adjustment event."));

            entity.HasIndex(e => new { e.CommissionId, e.AdjustedAt }, "idx_commission_adjustment_commission").IsDescending(false, true);

            entity.Property(e => e.CommissionAdjustmentId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("commission_adjustment_id");
            entity.Property(e => e.AdjustedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("adjusted_at");
            entity.Property(e => e.AdjustedBy).HasColumnName("adjusted_by");
            entity.Property(e => e.CommissionId).HasColumnName("commission_id");
            entity.Property(e => e.NewAmount)
                .HasPrecision(18, 2)
                .HasColumnName("new_amount");
            entity.Property(e => e.OldAmount)
                .HasPrecision(18, 2)
                .HasColumnName("old_amount");
            entity.Property(e => e.Reason).HasColumnName("reason");

            entity.HasOne(d => d.AdjustedByNavigation).WithMany(p => p.CommissionAdjustments)
                .HasForeignKey(d => d.AdjustedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("commission_adjustment_adjusted_by_fkey");

            entity.HasOne(d => d.Commission).WithMany(p => p.CommissionAdjustments)
                .HasForeignKey(d => d.CommissionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("commission_adjustment_commission_id_fkey");
        });

        modelBuilder.Entity<CommissionMilestone>(entity =>
        {
            entity.HasKey(e => e.MilestoneCode).HasName("commission_milestone_pkey");

            entity.ToTable("commission_milestone", "public");

            entity.Property(e => e.MilestoneCode)
                .HasMaxLength(60)
                .HasColumnName("milestone_code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<CommissionRule>(entity =>
        {
            entity.HasKey(e => e.CommissionRuleId).HasName("commission_rule_pkey");

            entity.ToTable("commission_rule", "public");

            entity.HasIndex(e => new { e.ServiceTypeId, e.MilestoneType, e.EffectiveFrom }, "idx_commission_rule_active")
                .IsDescending(false, false, true)
                .HasFilter("(is_active = true)");

            entity.Property(e => e.CommissionRuleId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("commission_rule_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EffectiveFrom).HasColumnName("effective_from");
            entity.Property(e => e.EffectiveTo).HasColumnName("effective_to");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.MilestoneType)
                .HasMaxLength(60)
                .HasColumnName("milestone_type");
            entity.Property(e => e.Name)
                .HasMaxLength(180)
                .HasColumnName("name");
            entity.Property(e => e.RateType)
                .HasMaxLength(30)
                .HasColumnName("rate_type");
            entity.Property(e => e.RateValue)
                .HasPrecision(18, 4)
                .HasColumnName("rate_value");
            entity.Property(e => e.ServiceTypeId).HasColumnName("service_type_id");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.WarrantyRequired)
                .HasDefaultValue(false)
                .HasColumnName("warranty_required");

            entity.HasOne(d => d.MilestoneTypeNavigation).WithMany(p => p.CommissionRules)
                .HasForeignKey(d => d.MilestoneType)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_commission_rule_milestone");

            entity.HasOne(d => d.ServiceType).WithMany(p => p.CommissionRules)
                .HasForeignKey(d => d.ServiceTypeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("commission_rule_service_type_id_fkey");
        });

        modelBuilder.Entity<Company>(entity =>
        {
            entity.HasKey(e => e.CompanyId).HasName("company_pkey");

            entity.ToTable("company", "public");

            entity.HasIndex(e => e.TaxCode, "uq_company_tax_code")
                .IsUnique()
                .HasFilter("(tax_code IS NOT NULL)");

            entity.Property(e => e.CompanyId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("company_id");
            entity.Property(e => e.Address).HasColumnName("address");
            entity.Property(e => e.CompanyName)
                .HasMaxLength(255)
                .HasColumnName("company_name");
            entity.Property(e => e.CompanySize)
                .HasMaxLength(50)
                .HasColumnName("company_size");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Industry)
                .HasMaxLength(120)
                .HasColumnName("industry");
            entity.Property(e => e.TaxCode)
                .HasMaxLength(80)
                .HasColumnName("tax_code");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.VerificationStatus)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("verification_status");
            entity.Property(e => e.VerifiedAt).HasColumnName("verified_at");
            entity.Property(e => e.Website)
                .HasMaxLength(255)
                .HasColumnName("website");
        });

        modelBuilder.Entity<CompanyUser>(entity =>
        {
            entity.HasKey(e => e.CompanyUserId).HasName("company_user_pkey");

            entity.ToTable("company_user", "public");

            entity.HasIndex(e => new { e.CompanyId, e.UserId }, "company_user_company_id_user_id_key").IsUnique();

            entity.HasIndex(e => e.CompanyId, "uq_company_primary_contact")
                .IsUnique()
                .HasFilter("((is_primary_contact = true) AND ((status)::text = 'ACTIVE'::text))");

            entity.Property(e => e.CompanyUserId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("company_user_id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IsPrimaryContact)
                .HasDefaultValue(false)
                .HasColumnName("is_primary_contact");
            entity.Property(e => e.RoleInCompany)
                .HasMaxLength(120)
                .HasColumnName("role_in_company");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Company).WithOne(p => p.CompanyUser)
                .HasForeignKey<CompanyUser>(d => d.CompanyId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("company_user_company_id_fkey");

            entity.HasOne(d => d.User).WithMany(p => p.CompanyUsers)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("company_user_user_id_fkey");
        });

        modelBuilder.Entity<CompanyVerificationRequest>(entity =>
        {
            entity.HasKey(e => e.CompanyVerificationRequestId).HasName("company_verification_request_pkey");

            entity.ToTable("company_verification_request", "public");

            entity.HasIndex(e => e.CompanyId, "uq_company_verification_open")
                .IsUnique()
                .HasFilter("((status)::text = ANY ((ARRAY['PENDING'::character varying, 'UNDER_REVIEW'::character varying])::text[]))");

            entity.Property(e => e.CompanyVerificationRequestId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("company_verification_request_id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.ReviewNote).HasColumnName("review_note");
            entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("submitted_at");
            entity.Property(e => e.SubmittedBy).HasColumnName("submitted_by");
            entity.Property(e => e.SubmittedPayload)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("submitted_payload");

            entity.HasOne(d => d.Company).WithOne(p => p.CompanyVerificationRequest)
                .HasForeignKey<CompanyVerificationRequest>(d => d.CompanyId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("company_verification_request_company_id_fkey");

            entity.HasOne(d => d.ReviewedByNavigation).WithMany(p => p.CompanyVerificationRequestReviewedByNavigations)
                .HasForeignKey(d => d.ReviewedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("company_verification_request_reviewed_by_fkey");

            entity.HasOne(d => d.SubmittedByNavigation).WithMany(p => p.CompanyVerificationRequestSubmittedByNavigations)
                .HasForeignKey(d => d.SubmittedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("company_verification_request_submitted_by_fkey");
        });

        modelBuilder.Entity<CvTemplate>(entity =>
        {
            entity.HasKey(e => e.CvTemplateId).HasName("cv_template_pkey");

            entity.ToTable("cv_template", "public");

            entity.HasIndex(e => e.Code, "cv_template_code_key").IsUnique();

            entity.Property(e => e.CvTemplateId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("cv_template_id");
            entity.Property(e => e.Code)
                .HasMaxLength(80)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name)
                .HasMaxLength(150)
                .HasColumnName("name");
            entity.Property(e => e.PreviewUrl).HasColumnName("preview_url");
            entity.Property(e => e.TemplateConfig)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("template_config");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<Dispute>(entity =>
        {
            entity.HasKey(e => e.DisputeId).HasName("dispute_pkey");

            entity.ToTable("dispute", "public");

            entity.Property(e => e.DisputeId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("dispute_id");
            entity.Property(e => e.AttributionId).HasColumnName("attribution_id");
            entity.Property(e => e.CommissionId).HasColumnName("commission_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.DisputeType)
                .HasMaxLength(40)
                .HasColumnName("dispute_type");
            entity.Property(e => e.Evidence)
                .HasDefaultValueSql("'[]'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("evidence");
            entity.Property(e => e.RaisedBy).HasColumnName("raised_by");
            entity.Property(e => e.Resolution).HasColumnName("resolution");
            entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
            entity.Property(e => e.ResolvedBy).HasColumnName("resolved_by");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'OPEN'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.SubmissionId).HasColumnName("submission_id");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Attribution).WithMany(p => p.Disputes)
                .HasForeignKey(d => d.AttributionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("dispute_attribution_id_fkey");

            entity.HasOne(d => d.Commission).WithMany(p => p.Disputes)
                .HasForeignKey(d => d.CommissionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("dispute_commission_id_fkey");

            entity.HasOne(d => d.RaisedByNavigation).WithMany(p => p.DisputeRaisedByNavigations)
                .HasForeignKey(d => d.RaisedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("dispute_raised_by_fkey");

            entity.HasOne(d => d.ResolvedByNavigation).WithMany(p => p.DisputeResolvedByNavigations)
                .HasForeignKey(d => d.ResolvedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("dispute_resolved_by_fkey");

            entity.HasOne(d => d.Submission).WithMany(p => p.Disputes)
                .HasForeignKey(d => d.SubmissionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("dispute_submission_id_fkey");
        });

        modelBuilder.Entity<EmailOutbox>(entity =>
        {
            entity.HasKey(e => e.EmailOutboxId).HasName("email_outbox_pkey");

            entity.ToTable("email_outbox", "public");

            entity.HasIndex(e => new { e.Status, e.NextRetryAt, e.CreatedAt }, "idx_email_outbox_pending").HasFilter("((status)::text = ANY ((ARRAY['PENDING'::character varying, 'FAILED'::character varying])::text[]))");

            entity.Property(e => e.EmailOutboxId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("email_outbox_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.LastError).HasColumnName("last_error");
            entity.Property(e => e.NextRetryAt).HasColumnName("next_retry_at");
            entity.Property(e => e.Payload)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("payload");
            entity.Property(e => e.RecipientEmail)
                .HasMaxLength(255)
                .HasColumnName("recipient_email");
            entity.Property(e => e.RetryCount)
                .HasDefaultValue(0)
                .HasColumnName("retry_count");
            entity.Property(e => e.SentAt).HasColumnName("sent_at");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.Subject)
                .HasMaxLength(255)
                .HasColumnName("subject");
            entity.Property(e => e.TemplateCode)
                .HasMaxLength(80)
                .HasColumnName("template_code");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.EmailOutboxes)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("email_outbox_user_id_fkey");
        });

        modelBuilder.Entity<InternalHrProfile>(entity =>
        {
            entity.HasKey(e => e.HrProfileId).HasName("internal_hr_profile_pkey");

            entity.ToTable("internal_hr_profile", "public");

            entity.HasIndex(e => e.EmployeeCode, "internal_hr_profile_employee_code_key").IsUnique();

            entity.HasIndex(e => e.UserId, "internal_hr_profile_user_id_key").IsUnique();

            entity.Property(e => e.HrProfileId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("hr_profile_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Department)
                .HasMaxLength(120)
                .HasColumnName("department");
            entity.Property(e => e.EmployeeCode)
                .HasMaxLength(50)
                .HasColumnName("employee_code");
            entity.Property(e => e.JobTitle)
                .HasMaxLength(120)
                .HasColumnName("job_title");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithOne(p => p.InternalHrProfile)
                .HasForeignKey<InternalHrProfile>(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("internal_hr_profile_user_id_fkey");
        });

        modelBuilder.Entity<Interview>(entity =>
        {
            entity.HasKey(e => e.InterviewId).HasName("interview_pkey");

            entity.ToTable("interview", "public", t => 
            {
                t.HasCheckConstraint("ck_interview_round_positive", "interview_round > 0");
                t.HasCheckConstraint("ck_interview_duration_positive", "duration_minutes IS NULL OR duration_minutes > 0");
            });

            entity.HasIndex(e => new { e.ApplicationId, e.InterviewRound }, "interview_application_id_interview_round_key").IsUnique();

            entity.Property(e => e.InterviewId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("interview_id");
            entity.Property(e => e.ApplicationId).HasColumnName("application_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.DurationMinutes).HasColumnName("duration_minutes");
            entity.Property(e => e.Feedback).HasColumnName("feedback");
            entity.Property(e => e.InterviewRound)
                .HasDefaultValue(1)
                .HasColumnName("interview_round");
            entity.Property(e => e.InterviewType)
                .HasMaxLength(50)
                .HasColumnName("interview_type");
            entity.Property(e => e.Location)
                .HasMaxLength(255)
                .HasColumnName("location");
            entity.Property(e => e.MeetingLink).HasColumnName("meeting_link");
            entity.Property(e => e.Result)
                .HasMaxLength(30)
                .HasColumnName("result");
            entity.Property(e => e.ScheduledAt).HasColumnName("scheduled_at");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'SCHEDULED'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Application).WithMany(p => p.Interviews)
                .HasForeignKey(d => d.ApplicationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("interview_application_id_fkey");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Interviews)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("interview_created_by_fkey");
        });

        modelBuilder.Entity<InterviewStatusHistory>(entity =>
        {
            entity.HasKey(e => e.InterviewStatusHistoryId).HasName("interview_status_history_pkey");

            entity.ToTable("interview_status_history", "hr_connect");

            entity.HasIndex(e => new { e.InterviewId, e.ChangedAt }, "idx_interview_status_history_interview").IsDescending(false, true);

            entity.Property(e => e.InterviewStatusHistoryId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("interview_status_history_id");
            entity.Property(e => e.InterviewId).HasColumnName("interview_id");
            entity.Property(e => e.OldStatus)
                .HasMaxLength(30)
                .HasColumnName("old_status");
            entity.Property(e => e.NewStatus)
                .HasMaxLength(30)
                .HasColumnName("new_status");
            entity.Property(e => e.OldScheduledAt).HasColumnName("old_scheduled_at");
            entity.Property(e => e.NewScheduledAt).HasColumnName("new_scheduled_at");
            entity.Property(e => e.ChangedBy).HasColumnName("changed_by");
            entity.Property(e => e.Reason).HasColumnName("reason");
            entity.Property(e => e.ChangedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("changed_at");

            entity.HasOne(d => d.Interview).WithMany(p => p.InterviewStatusHistories)
                .HasForeignKey(d => d.InterviewId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("interview_status_history_interview_id_fkey");

            entity.HasOne(d => d.ChangedByNavigation).WithMany(p => p.InterviewStatusHistories)
                .HasForeignKey(d => d.ChangedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("interview_status_history_changed_by_fkey");
        });

        modelBuilder.Entity<Job>(entity =>
        {
            entity.HasKey(e => e.JobId).HasName("job_pkey");

            entity.ToTable("job", "public");

            entity.HasIndex(e => new { e.CompanyId, e.ServiceTypeId, e.PostedAt }, "idx_job_active")
                .IsDescending(false, false, true)
                .HasFilter("((status)::text = 'ACTIVE'::text)");

            entity.HasIndex(e => new { e.CompanyId, e.Status }, "idx_job_company_status");

            entity.HasIndex(e => new { e.ServiceTypeId, e.Status }, "idx_job_service_type_status");

            entity.HasIndex(e => new { e.Visibility, e.Status, e.PostedAt }, "idx_job_visibility_status").IsDescending(false, false, true);

            entity.Property(e => e.JobId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("job_id");
            entity.Property(e => e.ClosedAt).HasColumnName("closed_at");
            entity.Property(e => e.CompanyId).HasColumnName("company_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CurrencyCode)
                .HasMaxLength(3)
                .HasDefaultValueSql("'VND'::bpchar")
                .IsFixedLength()
                .HasColumnName("currency_code");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.EmploymentType)
                .HasMaxLength(50)
                .HasColumnName("employment_type");
            entity.Property(e => e.Location)
                .HasMaxLength(255)
                .HasColumnName("location");
            entity.Property(e => e.PostedAt).HasColumnName("posted_at");
            entity.Property(e => e.Quantity)
                .HasDefaultValue(1)
                .HasColumnName("quantity");
            entity.Property(e => e.SalaryMax)
                .HasPrecision(18, 2)
                .HasColumnName("salary_max");
            entity.Property(e => e.SalaryMin)
                .HasPrecision(18, 2)
                .HasColumnName("salary_min");
            entity.Property(e => e.ServiceTypeId).HasColumnName("service_type_id");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'DRAFT'::character varying")
                .HasComment("Allowed Job states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined.")
                .HasColumnName("status");
            entity.Property(e => e.StatusReason).HasColumnName("status_reason");
            entity.Property(e => e.Title)
                .HasMaxLength(255)
                .HasColumnName("title");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.Visibility)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PUBLIC'::character varying")
                .HasComment("D07-ready job visibility. Exact actor permissions remain a business-rule/authorization concern.")
                .HasColumnName("visibility");

            entity.HasOne(d => d.Company).WithMany(p => p.Jobs)
                .HasForeignKey(d => d.CompanyId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("job_company_id_fkey");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Jobs)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("job_created_by_fkey");

            entity.HasOne(d => d.ServiceType).WithMany(p => p.Jobs)
                .HasForeignKey(d => d.ServiceTypeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("job_service_type_id_fkey");
        });

        modelBuilder.Entity<JobRequirement>(entity =>
        {
            entity.HasKey(e => e.RequirementId).HasName("job_requirement_pkey");

            entity.ToTable("job_requirement", "public");

            entity.Property(e => e.RequirementId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("requirement_id");
            entity.Property(e => e.Category)
                .HasMaxLength(120)
                .HasColumnName("category");
            entity.Property(e => e.Content).HasColumnName("content");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.RequirementType)
                .HasMaxLength(30)
                .HasColumnName("requirement_type");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.Weight)
                .HasPrecision(8, 4)
                .HasColumnName("weight");

            entity.HasOne(d => d.Job).WithMany(p => p.JobRequirements)
                .HasForeignKey(d => d.JobId)
                .HasConstraintName("job_requirement_job_id_fkey");
        });

        modelBuilder.Entity<JobSkill>(entity =>
        {
            entity.HasKey(e => new { e.JobId, e.SkillId }).HasName("job_skill_pkey");

            entity.ToTable("job_skill", "public");

            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.SkillId).HasColumnName("skill_id");
            entity.Property(e => e.IsMandatory)
                .HasDefaultValue(false)
                .HasColumnName("is_mandatory");
            entity.Property(e => e.Weight)
                .HasPrecision(8, 4)
                .HasColumnName("weight");

            entity.HasOne(d => d.Job).WithMany(p => p.JobSkills)
                .HasForeignKey(d => d.JobId)
                .HasConstraintName("job_skill_job_id_fkey");

            entity.HasOne(d => d.Skill).WithMany(p => p.JobSkills)
                .HasForeignKey(d => d.SkillId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("job_skill_skill_id_fkey");
        });

        modelBuilder.Entity<JobStatusHistory>(entity =>
        {
            entity.HasKey(e => e.JobStatusHistoryId).HasName("job_status_history_pkey");

            entity.ToTable("job_status_history", "public");

            entity.HasIndex(e => new { e.JobId, e.ChangedAt }, "idx_job_status_history_job").IsDescending(false, true);

            entity.Property(e => e.JobStatusHistoryId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("job_status_history_id");
            entity.Property(e => e.ChangedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("changed_at");
            entity.Property(e => e.ChangedBy).HasColumnName("changed_by");
            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.NewStatus)
                .HasMaxLength(30)
                .HasColumnName("new_status");
            entity.Property(e => e.OldStatus)
                .HasMaxLength(30)
                .HasColumnName("old_status");
            entity.Property(e => e.Reason).HasColumnName("reason");

            entity.HasOne(d => d.ChangedByNavigation).WithMany(p => p.JobStatusHistories)
                .HasForeignKey(d => d.ChangedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("job_status_history_changed_by_fkey");

            entity.HasOne(d => d.Job).WithMany(p => p.JobStatusHistories)
                .HasForeignKey(d => d.JobId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("job_status_history_job_id_fkey");
        });

        modelBuilder.Entity<MatchTierConfig>(entity =>
        {
            entity.HasKey(e => e.TierCode).HasName("match_tier_config_pkey");

            entity.ToTable("match_tier_config", "public");

            entity.Property(e => e.TierCode)
                .HasMaxLength(30)
                .HasColumnName("tier_code");
            entity.Property(e => e.ColorCode)
                .HasMaxLength(30)
                .HasColumnName("color_code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.DisplayName)
                .HasMaxLength(80)
                .HasColumnName("display_name");
            entity.Property(e => e.DisplayOrder).HasColumnName("display_order");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.MaxScore)
                .HasPrecision(5, 2)
                .HasColumnName("max_score");
            entity.Property(e => e.MinScore)
                .HasPrecision(5, 2)
                .HasColumnName("min_score");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.NotificationId).HasName("notification_pkey");

            entity.ToTable("notification", "public", tb => tb.HasComment("In-app notification store. JOB_FIT notifications may reference a Job through related_entity_type/related_entity_id."));

            entity.HasIndex(e => new { e.UserId, e.CreatedAt }, "idx_notification_unread")
                .IsDescending(false, true)
                .HasFilter("(is_read = false)");

            entity.HasIndex(e => new { e.UserId, e.CreatedAt }, "idx_notification_user_created").IsDescending(false, true);

            entity.Property(e => e.NotificationId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("notification_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IsRead)
                .HasDefaultValue(false)
                .HasColumnName("is_read");
            entity.Property(e => e.Message).HasColumnName("message");
            entity.Property(e => e.Metadata)
                .HasDefaultValueSql("'{}'::jsonb")
                .HasColumnType("jsonb")
                .HasColumnName("metadata");
            entity.Property(e => e.NotificationType)
                .HasMaxLength(50)
                .HasComment("JOB_FIT is optional D16; other values cover baseline account/company/job/submission/recruitment/commission events.")
                .HasColumnName("notification_type");
            entity.Property(e => e.ReadAt).HasColumnName("read_at");
            entity.Property(e => e.RelatedEntityId).HasColumnName("related_entity_id");
            entity.Property(e => e.RelatedEntityType)
                .HasMaxLength(60)
                .HasColumnName("related_entity_type");
            entity.Property(e => e.Title)
                .HasMaxLength(255)
                .HasColumnName("title");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("notification_user_id_fkey");
        });

        modelBuilder.Entity<Offer>(entity =>
        {
            entity.HasKey(e => e.OfferId).HasName("offer_pkey");

            entity.ToTable("offer", "public", t => 
            {
                t.HasCheckConstraint("ck_offer_version_positive", "offer_version > 0");
                t.HasCheckConstraint("ck_offer_salary_positive", "salary IS NULL OR salary >= 0");
                t.HasCheckConstraint("ck_offer_date_range", "expiry_date IS NULL OR start_date IS NULL OR expiry_date >= start_date");
                t.HasCheckConstraint("ck_offer_response_time", "responded_at IS NULL OR sent_at IS NULL OR responded_at >= sent_at");
                t.HasCheckConstraint("ck_offer_declined_response", "status <> 'DECLINED' OR responded_at IS NOT NULL");
            });

            entity.HasIndex(e => new { e.ApplicationId, e.OfferVersion }, "offer_application_id_offer_version_key").IsUnique();

            entity.HasIndex(e => new { e.OfferId, e.ApplicationId }, "uq_offer_application_pair").IsUnique();

            entity.Property(e => e.OfferId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("offer_id");
            entity.Property(e => e.ApplicationId).HasColumnName("application_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CurrencyCode)
                .HasMaxLength(3)
                .HasDefaultValueSql("'VND'::bpchar")
                .IsFixedLength()
                .HasColumnName("currency_code");
            entity.Property(e => e.DeclineReason).HasColumnName("decline_reason");
            entity.Property(e => e.ExpiryDate).HasColumnName("expiry_date");
            entity.Property(e => e.OfferDocumentUrl).HasColumnName("offer_document_url");
            entity.Property(e => e.OfferVersion)
                .HasDefaultValue(1)
                .HasColumnName("offer_version");
            entity.Property(e => e.RespondedAt).HasColumnName("responded_at");
            entity.Property(e => e.Salary)
                .HasPrecision(18, 2)
                .HasColumnName("salary");
            entity.Property(e => e.SentAt).HasColumnName("sent_at");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Application).WithMany(p => p.Offers)
                .HasForeignKey(d => d.ApplicationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("offer_application_id_fkey");

            entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Offers)
                .HasForeignKey(d => d.CreatedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("offer_created_by_fkey");
        });

        modelBuilder.Entity<OfferApproval>(entity =>
        {
            entity.HasKey(e => e.ApprovalId).HasName("offer_approval_pkey");

            entity.ToTable("offer_approval", "public", tb => tb.HasComment("PROPOSED. Remove if the team does not implement a separate offer approval workflow."));

            entity.HasIndex(e => new { e.OfferId, e.UserId }, "offer_approval_offer_id_user_id_key").IsUnique();

            entity.Property(e => e.ApprovalId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("approval_id");
            entity.Property(e => e.ApprovalType)
                .HasMaxLength(50)
                .HasColumnName("approval_type");
            entity.Property(e => e.Comment).HasColumnName("comment");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.OfferId).HasColumnName("offer_id");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasColumnName("status");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.Offer).WithMany(p => p.OfferApprovals)
                .HasForeignKey(d => d.OfferId)
                .HasConstraintName("offer_approval_offer_id_fkey");

            entity.HasOne(d => d.User).WithMany(p => p.OfferApprovals)
                .HasForeignKey(d => d.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("offer_approval_user_id_fkey");
        });

        modelBuilder.Entity<Payout>(entity =>
        {
            entity.HasKey(e => e.PayoutId).HasName("payout_pkey");

            entity.ToTable("payout", "public", tb => tb.HasComment("Manual/external payout ledger. Rows are never physically deleted. PENDING may become COMPLETED/FAILED/CANCELLED; terminal rows are immutable."));

            entity.HasIndex(e => new { e.CommissionId, e.Status, e.CreatedAt }, "idx_payout_commission_status").IsDescending(false, false, true);

            entity.HasIndex(e => new { e.CommissionId, e.AttemptNo }, "uq_payout_attempt").IsUnique();

            entity.Property(e => e.PayoutId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("payout_id");
            entity.Property(e => e.Amount)
                .HasPrecision(18, 2)
                .HasColumnName("amount");
            entity.Property(e => e.AttemptNo)
                .HasDefaultValue(1)
                .HasColumnName("attempt_no");
            entity.Property(e => e.CommissionId).HasColumnName("commission_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EvidenceUrl).HasColumnName("evidence_url");
            entity.Property(e => e.Method)
                .HasMaxLength(50)
                .HasColumnName("method");
            entity.Property(e => e.PayoutDate).HasColumnName("payout_date");
            entity.Property(e => e.RecordedBy).HasColumnName("recorded_by");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'PENDING'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.TransactionReference)
                .HasMaxLength(255)
                .HasColumnName("transaction_reference");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Commission).WithMany(p => p.Payouts)
                .HasForeignKey(d => d.CommissionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("payout_commission_id_fkey");

            entity.HasOne(d => d.RecordedByNavigation).WithMany(p => p.Payouts)
                .HasForeignKey(d => d.RecordedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("payout_recorded_by_fkey");
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.PermissionId).HasName("permission_pkey");

            entity.ToTable("permission", "public");

            entity.HasIndex(e => e.Code, "permission_code_key").IsUnique();

            entity.Property(e => e.PermissionId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("permission_id");
            entity.Property(e => e.Action)
                .HasMaxLength(60)
                .HasColumnName("action");
            entity.Property(e => e.Code)
                .HasMaxLength(120)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Resource)
                .HasMaxLength(100)
                .HasColumnName("resource");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<Placement>(entity =>
        {
            entity.HasKey(e => e.PlacementId).HasName("placement_pkey");

            entity.ToTable("placement", "public");

            entity.HasIndex(e => e.ApplicationId, "placement_application_id_key").IsUnique();

            entity.HasIndex(e => e.OfferId, "placement_offer_id_key").IsUnique();

            entity.Property(e => e.PlacementId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("placement_id");
            entity.Property(e => e.ActualStartDate).HasColumnName("actual_start_date");
            entity.Property(e => e.ApplicationId).HasColumnName("application_id");
            entity.Property(e => e.ConfirmationNote).HasColumnName("confirmation_note");
            entity.Property(e => e.ConfirmedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("confirmed_at");
            entity.Property(e => e.ConfirmedBy).HasColumnName("confirmed_by");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Department)
                .HasMaxLength(180)
                .HasColumnName("department");
            entity.Property(e => e.OfferId).HasColumnName("offer_id");
            entity.Property(e => e.Position)
                .HasMaxLength(180)
                .HasColumnName("position");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'STARTED'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Application).WithOne(p => p.Placement)
                .HasForeignKey<Placement>(d => d.ApplicationId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("placement_application_id_fkey");

            entity.HasOne(d => d.ConfirmedByNavigation).WithMany(p => p.Placements)
                .HasForeignKey(d => d.ConfirmedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("placement_confirmed_by_fkey");

            entity.HasOne(d => d.Offer).WithMany(p => p.Placements)
                .HasPrincipalKey(p => new { p.OfferId, p.ApplicationId })
                .HasForeignKey(d => new { d.OfferId, d.ApplicationId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_placement_offer_application");
        });

        modelBuilder.Entity<Probation>(entity =>
        {
            entity.HasKey(e => e.ProbationId).HasName("probation_pkey");

            entity.ToTable("probation", "public");

            entity.HasIndex(e => e.PlacementId, "probation_placement_id_key").IsUnique();

            entity.Property(e => e.ProbationId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("probation_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.Notes).HasColumnName("notes");
            entity.Property(e => e.PlacementId).HasColumnName("placement_id");
            entity.Property(e => e.Result)
                .HasMaxLength(30)
                .HasColumnName("result");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");

            entity.HasOne(d => d.Placement).WithOne(p => p.Probation)
                .HasForeignKey<Probation>(d => d.PlacementId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("probation_placement_id_fkey");

            entity.HasOne(d => d.UpdatedByNavigation).WithMany(p => p.Probations)
                .HasForeignKey(d => d.UpdatedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("probation_updated_by_fkey");
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.RefreshTokenId).HasName("refresh_token_pkey");

            entity.ToTable("refresh_token", "public");

            entity.HasIndex(e => new { e.UserId, e.ExpiresAt }, "idx_refresh_token_active")
                .IsDescending(false, true)
                .HasFilter("(revoked_at IS NULL)");

            entity.HasIndex(e => e.TokenHash, "refresh_token_token_hash_key").IsUnique();

            entity.Property(e => e.RefreshTokenId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("refresh_token_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedByIp).HasColumnName("created_by_ip");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.ReplacedByTokenId).HasColumnName("replaced_by_token_id");
            entity.Property(e => e.RevokeReason)
                .HasMaxLength(255)
                .HasColumnName("revoke_reason");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.RevokedByIp).HasColumnName("revoked_by_ip");
            entity.Property(e => e.TokenHash)
                .HasMaxLength(255)
                .HasColumnName("token_hash");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.ReplacedByToken).WithMany(p => p.InverseReplacedByToken)
                .HasForeignKey(d => d.ReplacedByTokenId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("refresh_token_replaced_by_token_id_fkey");

            entity.HasOne(d => d.User).WithMany(p => p.RefreshTokens)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("refresh_token_user_id_fkey");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.RoleId).HasName("role_pkey");

            entity.ToTable("role", "public");

            entity.HasIndex(e => e.Code, "role_code_key").IsUnique();

            entity.Property(e => e.RoleId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("role_id");
            entity.Property(e => e.Code)
                .HasMaxLength(60)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.IsSystem)
                .HasDefaultValue(true)
                .HasColumnName("is_system");
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(e => new { e.RoleId, e.PermissionId }).HasName("role_permission_pkey");

            entity.ToTable("role_permission", "public");

            entity.Property(e => e.RoleId).HasColumnName("role_id");
            entity.Property(e => e.PermissionId).HasColumnName("permission_id");
            entity.Property(e => e.GrantedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("granted_at");

            entity.HasOne(d => d.Permission).WithMany(p => p.RolePermissions)
                .HasForeignKey(d => d.PermissionId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("role_permission_permission_id_fkey");

            entity.HasOne(d => d.Role).WithMany(p => p.RolePermissions)
                .HasForeignKey(d => d.RoleId)
                .HasConstraintName("role_permission_role_id_fkey");
        });

        modelBuilder.Entity<ServiceType>(entity =>
        {
            entity.HasKey(e => e.ServiceTypeId).HasName("service_type_pkey");

            entity.ToTable("service_type", "public");

            entity.HasIndex(e => e.Code, "service_type_code_key").IsUnique();

            entity.Property(e => e.ServiceTypeId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("service_type_id");
            entity.Property(e => e.Code)
                .HasMaxLength(50)
                .HasColumnName("code");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.Name)
                .HasMaxLength(120)
                .HasColumnName("name");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<Skill>(entity =>
        {
            entity.HasKey(e => e.SkillId).HasName("skill_pkey");

            entity.ToTable("skill", "public");

            entity.HasIndex(e => e.NormalizedName, "skill_normalized_name_key").IsUnique();

            entity.Property(e => e.SkillId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("skill_id");
            entity.Property(e => e.Category)
                .HasMaxLength(120)
                .HasColumnName("category");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .HasColumnName("is_active");
            entity.Property(e => e.NormalizedName)
                .HasMaxLength(120)
                .HasColumnName("normalized_name");
            entity.Property(e => e.SkillName)
                .HasMaxLength(120)
                .HasColumnName("skill_name");
        });

        modelBuilder.Entity<Submission>(entity =>
        {
            entity.HasKey(e => e.SubmissionId).HasName("submission_pkey");

            entity.ToTable("submission", "public", tb => tb.HasComment("Submission intake/audit record. A Submission referenced by Application/Attribution as the accepted winner cannot be invalidated or have its accepted identity/source snapshot changed."));

            entity.HasIndex(e => new { e.JobId, e.CandidateId, e.SubmittedAt }, "idx_submission_job_candidate");

            entity.HasIndex(e => new { e.SubmittedBy, e.SubmittedAt }, "idx_submission_submitted_by").IsDescending(false, true);

            entity.HasIndex(e => new { e.SubmissionId, e.CandidateId, e.JobId }, "uq_submission_identity").IsUnique();

            entity.HasIndex(e => new { e.JobId, e.CandidateId }, "uq_submission_one_accepted")
                .IsUnique()
                .HasFilter("((status)::text = 'ACCEPTED'::text)");

            entity.Property(e => e.SubmissionId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("submission_id");
            entity.Property(e => e.CandidateId).HasColumnName("candidate_id");
            entity.Property(e => e.CvId).HasColumnName("cv_id");
            entity.Property(e => e.DuplicateOfSubmissionId).HasColumnName("duplicate_of_submission_id");
            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.Note).HasColumnName("note");
            entity.Property(e => e.Source)
                .HasMaxLength(30)
                .HasColumnName("source");
            entity.Property(e => e.Status)
                .HasMaxLength(40)
                .HasDefaultValueSql("'RECEIVED'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.SubmittedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("submitted_at");
            entity.Property(e => e.SubmittedBy).HasColumnName("submitted_by");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.Candidate).WithMany(p => p.Submissions)
                .HasForeignKey(d => d.CandidateId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("submission_candidate_id_fkey");

            entity.HasOne(d => d.DuplicateOfSubmission).WithMany(p => p.InverseDuplicateOfSubmission)
                .HasForeignKey(d => d.DuplicateOfSubmissionId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("submission_duplicate_of_submission_id_fkey");

            entity.HasOne(d => d.Job).WithMany(p => p.Submissions)
                .HasForeignKey(d => d.JobId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("submission_job_id_fkey");

            entity.HasOne(d => d.SubmittedByNavigation).WithMany(p => p.Submissions)
                .HasForeignKey(d => d.SubmittedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("submission_submitted_by_fkey");

            entity.HasOne(d => d.CandidateCv).WithMany(p => p.Submissions)
                .HasPrincipalKey(p => new { p.CandidateId, p.CvId })
                .HasForeignKey(d => new { d.CandidateId, d.CvId })
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_submission_cv_owner");
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.RoleId }).HasName("user_role_pkey");

            entity.ToTable("user_role", "public", tb => tb.HasComment("Role ownership/lifecycle. Candidate and Affiliate may coexist on the same app_user. Other multi-role combinations remain subject to business policy."));

            entity.HasIndex(e => new { e.UserId, e.RoleId }, "idx_user_role_active_user").HasFilter("((status)::text = 'ACTIVE'::text)");

            entity.HasIndex(e => e.RoleId, "idx_user_role_role_id");

            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.RoleId).HasColumnName("role_id");
            entity.Property(e => e.AssignedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("assigned_at");
            entity.Property(e => e.AssignedBy).HasColumnName("assigned_by");
            entity.Property(e => e.AssignmentSource)
                .HasMaxLength(40)
                .HasDefaultValueSql("'SYSTEM'::character varying")
                .HasColumnName("assignment_source");
            entity.Property(e => e.RevokeReason).HasColumnName("revoke_reason");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.RevokedBy).HasColumnName("revoked_by");
            entity.Property(e => e.Status)
                .HasMaxLength(20)
                .HasDefaultValueSql("'ACTIVE'::character varying")
                .HasColumnName("status");

            entity.HasOne(d => d.AssignedByNavigation).WithMany(p => p.UserRoleAssignedByNavigations)
                .HasForeignKey(d => d.AssignedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("user_role_assigned_by_fkey");

            entity.HasOne(d => d.RevokedByNavigation).WithMany(p => p.UserRoleRevokedByNavigations)
                .HasForeignKey(d => d.RevokedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("fk_user_role_revoked_by");

            entity.HasOne(d => d.Role).WithMany(p => p.UserRoles)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("user_role_role_id_fkey");

            entity.HasOne(d => d.User).WithMany(p => p.UserRoleUsers)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("user_role_user_id_fkey");
        });

        modelBuilder.Entity<UserToken>(entity =>
        {
            entity.HasKey(e => e.TokenId).HasName("user_token_pkey");

            entity.ToTable("user_token", "public");

            entity.HasIndex(e => new { e.UserId, e.TokenType, e.ExpiresAt }, "idx_user_token_active").HasFilter("(used_at IS NULL)");

            entity.HasIndex(e => new { e.UserId, e.TokenType, e.ExpiresAt }, "idx_user_token_lookup").IsDescending(false, false, true);

            entity.Property(e => e.TokenId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("token_id");
            entity.Property(e => e.AttemptCount)
                .HasDefaultValue(0)
                .HasColumnName("attempt_count");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.CreatedByIp).HasColumnName("created_by_ip");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.TokenHash)
                .HasMaxLength(255)
                .HasColumnName("token_hash");
            entity.Property(e => e.TokenType)
                .HasMaxLength(40)
                .HasColumnName("token_type");
            entity.Property(e => e.UsedAt).HasColumnName("used_at");
            entity.Property(e => e.UserId).HasColumnName("user_id");

            entity.HasOne(d => d.User).WithMany(p => p.UserTokens)
                .HasForeignKey(d => d.UserId)
                .HasConstraintName("user_token_user_id_fkey");
        });

        modelBuilder.Entity<Warranty>(entity =>
        {
            entity.HasKey(e => e.WarrantyId).HasName("warranty_pkey");

            entity.ToTable("warranty", "public", tb => tb.HasComment("Warranty exists only when applicable. No row may represent NOT_APPLICABLE; absence of a warranty row means not applicable."));

            entity.HasIndex(e => e.PlacementId, "warranty_placement_id_key").IsUnique();

            entity.Property(e => e.WarrantyId)
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("warranty_id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.EndDate).HasColumnName("end_date");
            entity.Property(e => e.PlacementId).HasColumnName("placement_id");
            entity.Property(e => e.ResultNote).HasColumnName("result_note");
            entity.Property(e => e.StartDate).HasColumnName("start_date");
            entity.Property(e => e.Status)
                .HasMaxLength(30)
                .HasDefaultValueSql("'IN_PROGRESS'::character varying")
                .HasColumnName("status");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
            entity.Property(e => e.UpdatedBy).HasColumnName("updated_by");

            entity.HasOne(d => d.Placement).WithOne(p => p.Warranty)
                .HasForeignKey<Warranty>(d => d.PlacementId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("warranty_placement_id_fkey");

            entity.HasOne(d => d.UpdatedByNavigation).WithMany(p => p.Warranties)
                .HasForeignKey(d => d.UpdatedBy)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("warranty_updated_by_fkey");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
