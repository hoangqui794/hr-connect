using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Persistence;

public partial class ApplicationDbContext
{
    private static void ConfigureCandidateIdentityDedup(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Candidate>(entity =>
        {
            entity.Property(e => e.MergeConcurrencyToken)
                .IsConcurrencyToken()
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("merge_concurrency_token");
            entity.HasIndex(e => e.MergedIntoCandidateId, "idx_candidate_merged_into");
        });

        modelBuilder.Entity<CandidateCv>(entity =>
        {
            entity.Property(e => e.ContentSha256).HasMaxLength(64).HasColumnName("content_sha256");
            entity.Property(e => e.TextFingerprint).HasMaxLength(128).HasColumnName("text_fingerprint");
            entity.Property(e => e.FingerprintVersion).HasMaxLength(30).HasColumnName("fingerprint_version");
            entity.HasIndex(e => e.ContentSha256, "idx_candidate_cv_content_sha256")
                .HasFilter("content_sha256 IS NOT NULL");
        });

        modelBuilder.Entity<Attribution>(entity =>
        {
            entity.Property(e => e.ConcurrencyToken)
                .IsConcurrencyToken()
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("concurrency_token");
        });

        modelBuilder.Entity<Dispute>(entity =>
        {
            entity.Property(e => e.ConcurrencyToken)
                .IsConcurrencyToken()
                .HasDefaultValueSql("gen_random_uuid()")
                .HasColumnName("concurrency_token");
            entity.Property(e => e.CandidateDuplicateCaseId).HasColumnName("candidate_duplicate_case_id");
            entity.HasIndex(e => e.CandidateDuplicateCaseId, "idx_dispute_candidate_duplicate_case")
                .HasFilter("candidate_duplicate_case_id IS NOT NULL");
            entity.HasOne(e => e.CandidateDuplicateCase).WithMany(e => e.Disputes)
                .HasForeignKey(e => e.CandidateDuplicateCaseId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_dispute_candidate_duplicate_case");
        });

        modelBuilder.Entity<SubmissionIdentitySnapshot>(entity =>
        {
            entity.HasKey(e => e.SubmissionId).HasName("submission_identity_snapshot_pkey");
            entity.ToTable("submission_identity_snapshot", "public", table =>
            {
                table.HasComment("Immutable privacy-minimized identity evidence captured at submission intake.");
                table.HasCheckConstraint("ck_submission_identity_snapshot_contact_source", "asserted_contact_source IN ('AFFILIATE','CANDIDATE','SYSTEM')");
                table.HasCheckConstraint("ck_submission_identity_snapshot_verification", "verification_level IN ('ASSERTED','EMAIL_VERIFIED','PHONE_VERIFIED','CANDIDATE_CONFIRMED')");
            });
            entity.Property(e => e.SubmissionId).HasColumnName("submission_id");
            entity.Property(e => e.NormalizedNameHash).HasMaxLength(128).HasColumnName("normalized_name_hash");
            entity.Property(e => e.EmailHmac).HasMaxLength(128).HasColumnName("email_hmac");
            entity.Property(e => e.PhoneHmac).HasMaxLength(128).HasColumnName("phone_hmac");
            entity.Property(e => e.HmacKeyVersion).HasMaxLength(30).HasColumnName("hmac_key_version");
            entity.Property(e => e.CvContentSha256).HasMaxLength(64).HasColumnName("cv_content_sha256");
            entity.Property(e => e.CvTextFingerprint).HasMaxLength(128).HasColumnName("cv_text_fingerprint");
            entity.Property(e => e.FingerprintVersion).HasMaxLength(30).HasColumnName("fingerprint_version");
            entity.Property(e => e.AssertedContactSource).HasMaxLength(30).HasColumnName("asserted_contact_source");
            entity.Property(e => e.VerificationLevel).HasMaxLength(30).HasColumnName("verification_level");
            entity.Property(e => e.CapturedAt).HasDefaultValueSql("now()").HasColumnName("captured_at");
            entity.HasIndex(e => new { e.EmailHmac, e.HmacKeyVersion }, "idx_submission_identity_email_hmac")
                .HasFilter("email_hmac IS NOT NULL");
            entity.HasIndex(e => new { e.PhoneHmac, e.HmacKeyVersion }, "idx_submission_identity_phone_hmac")
                .HasFilter("phone_hmac IS NOT NULL");
            entity.HasIndex(e => e.CvContentSha256, "idx_submission_identity_cv_sha256")
                .HasFilter("cv_content_sha256 IS NOT NULL");
            entity.HasOne(e => e.Submission).WithOne(e => e.IdentitySnapshot)
                .HasForeignKey<SubmissionIdentitySnapshot>(e => e.SubmissionId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_submission_identity_snapshot_submission");
        });

        modelBuilder.Entity<CandidateDuplicateCase>(entity =>
        {
            entity.HasKey(e => e.DuplicateCaseId).HasName("candidate_duplicate_case_pkey");
            entity.ToTable("candidate_duplicate_case", "public", table =>
            {
                table.HasComment("Reviewable duplicate identity case. Similarity alone never merges Candidates.");
                table.HasCheckConstraint("ck_candidate_duplicate_case_order", "candidate_a_id < candidate_b_id");
                table.HasCheckConstraint("ck_candidate_duplicate_case_risk", "risk_level IN ('REVIEW','HIGH')");
                table.HasCheckConstraint("ck_candidate_duplicate_case_status", "status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','MERGED','DISMISSED','BLOCKED_FINANCE')");
                table.HasCheckConstraint("ck_candidate_duplicate_case_resolution", "resolution IS NULL OR resolution IN ('MERGED','NOT_DUPLICATE','NO_ACTION','FINANCE_BLOCKED')");
            });
            entity.Property(e => e.DuplicateCaseId).HasDefaultValueSql("gen_random_uuid()").HasColumnName("duplicate_case_id");
            entity.Property(e => e.CandidateAId).HasColumnName("candidate_a_id");
            entity.Property(e => e.CandidateBId).HasColumnName("candidate_b_id");
            entity.Property(e => e.SubmissionId).HasColumnName("submission_id");
            entity.Property(e => e.JobId).HasColumnName("job_id");
            entity.Property(e => e.RiskLevel).HasMaxLength(20).HasColumnName("risk_level");
            entity.Property(e => e.Status).HasMaxLength(30).HasColumnName("status");
            entity.Property(e => e.Resolution).HasMaxLength(30).HasColumnName("resolution");
            entity.Property(e => e.ResolutionReason).HasMaxLength(1000).HasColumnName("resolution_reason");
            entity.Property(e => e.CanonicalCandidateId).HasColumnName("canonical_candidate_id");
            entity.Property(e => e.ReviewedBy).HasColumnName("reviewed_by");
            entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
            entity.Property(e => e.ConcurrencyToken).IsConcurrencyToken().HasDefaultValueSql("gen_random_uuid()").HasColumnName("concurrency_token");
            entity.Property(e => e.IdempotencyKey).HasMaxLength(160).HasColumnName("idempotency_key");
            entity.Property(e => e.ResolutionIdempotencyKey).HasMaxLength(160).HasColumnName("resolution_idempotency_key");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()").HasColumnName("updated_at");

            entity.HasIndex(e => e.IdempotencyKey, "uq_candidate_duplicate_case_idempotency").IsUnique();
            entity.HasIndex(e => e.ResolutionIdempotencyKey, "uq_candidate_duplicate_case_resolution_idempotency")
                .IsUnique().HasFilter("resolution_idempotency_key IS NOT NULL");
            entity.HasIndex(e => new { e.CandidateAId, e.CandidateBId, e.JobId }, "uq_candidate_duplicate_case_active_job")
                .IsUnique().HasFilter("job_id IS NOT NULL AND status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','BLOCKED_FINANCE')");
            entity.HasIndex(e => new { e.CandidateAId, e.CandidateBId }, "uq_candidate_duplicate_case_active_global")
                .IsUnique().HasFilter("job_id IS NULL AND status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','BLOCKED_FINANCE')");
            entity.HasIndex(e => new { e.Status, e.CreatedAt }, "idx_candidate_duplicate_case_status_created");
            entity.HasIndex(e => e.CanonicalCandidateId, "idx_candidate_duplicate_case_canonical")
                .HasFilter("canonical_candidate_id IS NOT NULL");

            entity.HasOne(e => e.CandidateA).WithMany().HasForeignKey(e => e.CandidateAId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_candidate_duplicate_case_candidate_a");
            entity.HasOne(e => e.CandidateB).WithMany().HasForeignKey(e => e.CandidateBId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_candidate_duplicate_case_candidate_b");
            entity.HasOne(e => e.CanonicalCandidate).WithMany().HasForeignKey(e => e.CanonicalCandidateId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_candidate_duplicate_case_canonical");
            entity.HasOne(e => e.Submission).WithMany().HasForeignKey(e => e.SubmissionId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_candidate_duplicate_case_submission");
            entity.HasOne(e => e.Job).WithMany().HasForeignKey(e => e.JobId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_candidate_duplicate_case_job");
            entity.HasOne(e => e.Reviewer).WithMany().HasForeignKey(e => e.ReviewedBy).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_candidate_duplicate_case_reviewer");
        });

        modelBuilder.Entity<CandidateDuplicateSignal>(entity =>
        {
            entity.HasKey(e => e.DuplicateSignalId).HasName("candidate_duplicate_signal_pkey");
            entity.ToTable("candidate_duplicate_signal", "public", table =>
            {
                table.HasComment("Minimized explainable evidence; raw PII and CV text are prohibited.");
                table.HasCheckConstraint("ck_candidate_duplicate_signal_score", "score >= 0 AND score <= 1");
            });
            entity.Property(e => e.DuplicateSignalId).HasDefaultValueSql("gen_random_uuid()").HasColumnName("duplicate_signal_id");
            entity.Property(e => e.DuplicateCaseId).HasColumnName("duplicate_case_id");
            entity.Property(e => e.ReasonCode).HasMaxLength(80).HasColumnName("reason_code");
            entity.Property(e => e.DetectorVersion).HasMaxLength(30).HasColumnName("detector_version");
            entity.Property(e => e.Score).HasPrecision(5, 4).HasColumnName("score");
            entity.Property(e => e.KeyVersion).HasMaxLength(30).HasColumnName("key_version");
            entity.Property(e => e.Evidence).HasColumnType("jsonb").HasColumnName("evidence");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
            entity.HasIndex(e => new { e.DuplicateCaseId, e.ReasonCode }, "uq_candidate_duplicate_signal_reason").IsUnique();
            entity.HasOne(e => e.DuplicateCase).WithMany(e => e.Signals)
                .HasForeignKey(e => e.DuplicateCaseId).OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("fk_candidate_duplicate_signal_case");
        });
    }
}
