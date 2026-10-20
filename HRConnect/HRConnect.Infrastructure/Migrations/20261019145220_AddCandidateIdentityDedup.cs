using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateIdentityDedup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uq_submission_one_pending_consent",
                schema: "public",
                table: "submission");

            migrationBuilder.DropCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission");

            migrationBuilder.RenameIndex(
                name: "IX_candidate_merged_into_candidate_id",
                schema: "public",
                table: "candidate",
                newName: "idx_candidate_merged_into");

            migrationBuilder.AddColumn<Guid>(
                name: "candidate_duplicate_case_id",
                schema: "public",
                table: "dispute",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "concurrency_token",
                schema: "public",
                table: "dispute",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<string>(
                name: "content_sha256",
                schema: "public",
                table: "candidate_cv",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "fingerprint_version",
                schema: "public",
                table: "candidate_cv",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "text_fingerprint",
                schema: "public",
                table: "candidate_cv",
                type: "character varying(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "merge_concurrency_token",
                schema: "public",
                table: "candidate",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<Guid>(
                name: "concurrency_token",
                schema: "public",
                table: "attribution",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.CreateTable(
                name: "candidate_duplicate_case",
                schema: "public",
                columns: table => new
                {
                    duplicate_case_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    candidate_a_id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_b_id = table.Column<Guid>(type: "uuid", nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: true),
                    job_id = table.Column<Guid>(type: "uuid", nullable: true),
                    risk_level = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    resolution = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    resolution_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    canonical_candidate_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    idempotency_key = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("candidate_duplicate_case_pkey", x => x.duplicate_case_id);
                    table.CheckConstraint("ck_candidate_duplicate_case_order", "candidate_a_id < candidate_b_id");
                    table.CheckConstraint("ck_candidate_duplicate_case_resolution", "resolution IS NULL OR resolution IN ('MERGED','NOT_DUPLICATE','NO_ACTION','FINANCE_BLOCKED')");
                    table.CheckConstraint("ck_candidate_duplicate_case_risk", "risk_level IN ('REVIEW','HIGH')");
                    table.CheckConstraint("ck_candidate_duplicate_case_status", "status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','MERGED','DISMISSED','BLOCKED_FINANCE')");
                    table.ForeignKey(
                        name: "fk_candidate_duplicate_case_candidate_a",
                        column: x => x.candidate_a_id,
                        principalSchema: "public",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_candidate_duplicate_case_candidate_b",
                        column: x => x.candidate_b_id,
                        principalSchema: "public",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_candidate_duplicate_case_canonical",
                        column: x => x.canonical_candidate_id,
                        principalSchema: "public",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_candidate_duplicate_case_job",
                        column: x => x.job_id,
                        principalSchema: "public",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_candidate_duplicate_case_reviewer",
                        column: x => x.reviewed_by,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_candidate_duplicate_case_submission",
                        column: x => x.submission_id,
                        principalSchema: "public",
                        principalTable: "submission",
                        principalColumn: "submission_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Reviewable duplicate identity case. Similarity alone never merges Candidates.");

            migrationBuilder.CreateTable(
                name: "submission_identity_snapshot",
                schema: "public",
                columns: table => new
                {
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    normalized_name_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    email_hmac = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    phone_hmac = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    hmac_key_version = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    cv_content_sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    cv_text_fingerprint = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    fingerprint_version = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    asserted_contact_source = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    verification_level = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    captured_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("submission_identity_snapshot_pkey", x => x.submission_id);
                    table.CheckConstraint("ck_submission_identity_snapshot_contact_source", "asserted_contact_source IN ('AFFILIATE','CANDIDATE','SYSTEM')");
                    table.CheckConstraint("ck_submission_identity_snapshot_verification", "verification_level IN ('ASSERTED','EMAIL_VERIFIED','PHONE_VERIFIED','CANDIDATE_CONFIRMED')");
                    table.ForeignKey(
                        name: "fk_submission_identity_snapshot_submission",
                        column: x => x.submission_id,
                        principalSchema: "public",
                        principalTable: "submission",
                        principalColumn: "submission_id",
                        onDelete: ReferentialAction.Cascade);
                },
                comment: "Immutable privacy-minimized identity evidence captured at submission intake.");

            migrationBuilder.CreateTable(
                name: "candidate_duplicate_signal",
                schema: "public",
                columns: table => new
                {
                    duplicate_signal_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    duplicate_case_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason_code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    detector_version = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    score = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    key_version = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    evidence = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("candidate_duplicate_signal_pkey", x => x.duplicate_signal_id);
                    table.CheckConstraint("ck_candidate_duplicate_signal_score", "score >= 0 AND score <= 1");
                    table.ForeignKey(
                        name: "fk_candidate_duplicate_signal_case",
                        column: x => x.duplicate_case_id,
                        principalSchema: "public",
                        principalTable: "candidate_duplicate_case",
                        principalColumn: "duplicate_case_id",
                        onDelete: ReferentialAction.Cascade);
                },
                comment: "Minimized explainable evidence; raw PII and CV text are prohibited.");

            migrationBuilder.CreateIndex(
                name: "uq_submission_one_pending_consent",
                schema: "public",
                table: "submission",
                columns: new[] { "job_id", "candidate_id", "submitted_by" },
                unique: true,
                filter: "status IN ('PENDING_CONSENT','PENDING_IDENTITY_REVIEW')");

            migrationBuilder.AddCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission",
                sql: "status IN ('RECEIVED','PENDING_CONSENT','PENDING_IDENTITY_REVIEW','ACCEPTED','BLOCKED_DUPLICATE','BLOCKED_CLIENT_OWNED','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED')");

            migrationBuilder.CreateIndex(
                name: "idx_dispute_candidate_duplicate_case",
                schema: "public",
                table: "dispute",
                column: "candidate_duplicate_case_id",
                filter: "candidate_duplicate_case_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_candidate_cv_content_sha256",
                schema: "public",
                table: "candidate_cv",
                column: "content_sha256",
                filter: "content_sha256 IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_candidate_duplicate_case_canonical",
                schema: "public",
                table: "candidate_duplicate_case",
                column: "canonical_candidate_id",
                filter: "canonical_candidate_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_candidate_duplicate_case_status_created",
                schema: "public",
                table: "candidate_duplicate_case",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_candidate_duplicate_case_candidate_b_id",
                schema: "public",
                table: "candidate_duplicate_case",
                column: "candidate_b_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_duplicate_case_job_id",
                schema: "public",
                table: "candidate_duplicate_case",
                column: "job_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_duplicate_case_reviewed_by",
                schema: "public",
                table: "candidate_duplicate_case",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_duplicate_case_submission_id",
                schema: "public",
                table: "candidate_duplicate_case",
                column: "submission_id");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_duplicate_case_active_global",
                schema: "public",
                table: "candidate_duplicate_case",
                columns: new[] { "candidate_a_id", "candidate_b_id" },
                unique: true,
                filter: "job_id IS NULL AND status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','BLOCKED_FINANCE')");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_duplicate_case_active_job",
                schema: "public",
                table: "candidate_duplicate_case",
                columns: new[] { "candidate_a_id", "candidate_b_id", "job_id" },
                unique: true,
                filter: "job_id IS NOT NULL AND status IN ('OPEN','AWAITING_CANDIDATE','UNDER_REVIEW','BLOCKED_FINANCE')");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_duplicate_case_idempotency",
                schema: "public",
                table: "candidate_duplicate_case",
                column: "idempotency_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_candidate_duplicate_signal_reason",
                schema: "public",
                table: "candidate_duplicate_signal",
                columns: new[] { "duplicate_case_id", "reason_code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_submission_identity_cv_sha256",
                schema: "public",
                table: "submission_identity_snapshot",
                column: "cv_content_sha256",
                filter: "cv_content_sha256 IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_submission_identity_email_hmac",
                schema: "public",
                table: "submission_identity_snapshot",
                columns: new[] { "email_hmac", "hmac_key_version" },
                filter: "email_hmac IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_submission_identity_phone_hmac",
                schema: "public",
                table: "submission_identity_snapshot",
                columns: new[] { "phone_hmac", "hmac_key_version" },
                filter: "phone_hmac IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "fk_dispute_candidate_duplicate_case",
                schema: "public",
                table: "dispute",
                column: "candidate_duplicate_case_id",
                principalSchema: "public",
                principalTable: "candidate_duplicate_case",
                principalColumn: "duplicate_case_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_dispute_candidate_duplicate_case",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropTable(
                name: "candidate_duplicate_signal",
                schema: "public");

            migrationBuilder.DropTable(
                name: "submission_identity_snapshot",
                schema: "public");

            migrationBuilder.DropTable(
                name: "candidate_duplicate_case",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "uq_submission_one_pending_consent",
                schema: "public",
                table: "submission");

            migrationBuilder.DropCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission");

            migrationBuilder.DropIndex(
                name: "idx_dispute_candidate_duplicate_case",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropIndex(
                name: "idx_candidate_cv_content_sha256",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "candidate_duplicate_case_id",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropColumn(
                name: "concurrency_token",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropColumn(
                name: "content_sha256",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "fingerprint_version",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "text_fingerprint",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "merge_concurrency_token",
                schema: "public",
                table: "candidate");

            migrationBuilder.DropColumn(
                name: "concurrency_token",
                schema: "public",
                table: "attribution");

            migrationBuilder.RenameIndex(
                name: "idx_candidate_merged_into",
                schema: "public",
                table: "candidate",
                newName: "IX_candidate_merged_into_candidate_id");

            migrationBuilder.CreateIndex(
                name: "uq_submission_one_pending_consent",
                schema: "public",
                table: "submission",
                columns: new[] { "job_id", "candidate_id" },
                unique: true,
                filter: "((status)::text = 'PENDING_CONSENT'::text)");

            migrationBuilder.AddCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission",
                sql: "status IN ('RECEIVED','PENDING_CONSENT','ACCEPTED','BLOCKED_DUPLICATE','BLOCKED_CLIENT_OWNED','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED')");
        }
    }
}
