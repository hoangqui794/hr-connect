using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateIdentityClaims : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT lower(btrim(email))
                        FROM public.app_user
                        GROUP BY lower(btrim(email))
                        HAVING count(*) > 1
                    ) THEN
                        RAISE EXCEPTION 'Cannot backfill user_email_identity: duplicate normalized app_user emails exist.';
                    END IF;
                END
                $$;
                """);

            migrationBuilder.CreateTable(
                name: "candidate_identity_claim",
                schema: "public",
                columns: table => new
                {
                    claim_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    requester_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requester_candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_candidate_id = table.Column<Guid>(type: "uuid", nullable: true),
                    asserted_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    normalized_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    token_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    resend_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    last_sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    review_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    concurrency_token = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("candidate_identity_claim_pkey", x => x.claim_id);
                    table.CheckConstraint("ck_candidate_identity_claim_attempts", "attempt_count >= 0 AND resend_count >= 0");
                    table.CheckConstraint("ck_candidate_identity_claim_expiry", "expires_at > created_at");
                    table.CheckConstraint("ck_candidate_identity_claim_status", "status IN ('PENDING_VERIFICATION','VERIFIED','COMPLETED','PENDING_ADMIN_REVIEW','REJECTED','EXPIRED','CANCELLED')");
                    table.ForeignKey(
                        name: "candidate_identity_claim_requester_candidate_id_fkey",
                        column: x => x.requester_candidate_id,
                        principalSchema: "public",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "candidate_identity_claim_requester_user_id_fkey",
                        column: x => x.requester_user_id,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "candidate_identity_claim_reviewed_by_fkey",
                        column: x => x.reviewed_by,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "candidate_identity_claim_target_candidate_id_fkey",
                        column: x => x.target_candidate_id,
                        principalSchema: "public",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_email_identity",
                schema: "public",
                columns: table => new
                {
                    email_identity_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    normalized_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    verification_source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    concurrency_token = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("user_email_identity_pkey", x => x.email_identity_id);
                    table.CheckConstraint("ck_user_email_identity_kind", "kind IN ('PRIMARY','ALIAS')");
                    table.CheckConstraint("ck_user_email_identity_revoked_at", "status <> 'REVOKED' OR revoked_at IS NOT NULL");
                    table.CheckConstraint("ck_user_email_identity_status", "status IN ('PENDING','VERIFIED','REVOKED')");
                    table.CheckConstraint("ck_user_email_identity_verified_at", "status <> 'VERIFIED' OR verified_at IS NOT NULL");
                    table.ForeignKey(
                        name: "user_email_identity_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql(
                """
                INSERT INTO public.user_email_identity
                    (email_identity_id, user_id, email, normalized_email, kind, status,
                     verification_source, verified_at, created_at, updated_at, concurrency_token)
                SELECT
                    gen_random_uuid(),
                    user_id,
                    email,
                    lower(btrim(email)),
                    'PRIMARY',
                    CASE WHEN email_verified_at IS NULL THEN 'PENDING' ELSE 'VERIFIED' END,
                    'REGISTRATION',
                    email_verified_at,
                    created_at,
                    updated_at,
                    gen_random_uuid()
                FROM public.app_user;
                """);

            migrationBuilder.CreateIndex(
                name: "idx_candidate_identity_claim_status_expiry",
                schema: "public",
                table: "candidate_identity_claim",
                columns: new[] { "status", "expires_at" });

            migrationBuilder.CreateIndex(
                name: "IX_candidate_identity_claim_requester_candidate_id",
                schema: "public",
                table: "candidate_identity_claim",
                column: "requester_candidate_id");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_identity_claim_reviewed_by",
                schema: "public",
                table: "candidate_identity_claim",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_identity_claim_active_requester_email",
                schema: "public",
                table: "candidate_identity_claim",
                columns: new[] { "requester_user_id", "normalized_email" },
                unique: true,
                filter: "status IN ('PENDING_VERIFICATION','VERIFIED','PENDING_ADMIN_REVIEW')");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_identity_claim_active_target",
                schema: "public",
                table: "candidate_identity_claim",
                column: "target_candidate_id",
                unique: true,
                filter: "target_candidate_id IS NOT NULL AND status IN ('VERIFIED','PENDING_ADMIN_REVIEW')");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_identity_claim_token_hash",
                schema: "public",
                table: "candidate_identity_claim",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_user_email_identity_user_status",
                schema: "public",
                table: "user_email_identity",
                columns: new[] { "user_id", "status" });

            migrationBuilder.CreateIndex(
                name: "uq_user_email_identity_active_email",
                schema: "public",
                table: "user_email_identity",
                column: "normalized_email",
                unique: true,
                filter: "status <> 'REVOKED'");

            migrationBuilder.CreateIndex(
                name: "uq_user_email_identity_primary_user",
                schema: "public",
                table: "user_email_identity",
                columns: new[] { "user_id", "kind" },
                unique: true,
                filter: "kind = 'PRIMARY' AND status <> 'REVOKED'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "candidate_identity_claim",
                schema: "public");

            migrationBuilder.DropTable(
                name: "user_email_identity",
                schema: "public");
        }
    }
}
