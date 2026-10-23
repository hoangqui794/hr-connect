using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceAgreement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "current_service_agreement_id",
                schema: "public",
                table: "job",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "service_agreement",
                schema: "public",
                columns: table => new
                {
                    service_agreement_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    service_type_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    concurrency_token = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    is_current = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    fee_multiplier = table.Column<decimal>(type: "numeric(6,3)", precision: 6, scale: 3, nullable: true),
                    warranty_days = table.Column<int>(type: "integer", nullable: true),
                    payment_due_days = table.Column<int>(type: "integer", nullable: true),
                    price_per_qualified_cv = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    sourcing_target = table.Column<int>(type: "integer", nullable: true),
                    review_days = table.Column<int>(type: "integer", nullable: true),
                    agreement_note = table.Column<string>(type: "text", nullable: true),
                    change_request_reason = table.Column<string>(type: "text", nullable: true),
                    company_name_snapshot = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    company_tax_code_snapshot = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    company_address_snapshot = table.Column<string>(type: "text", nullable: true),
                    hrconnect_legal_entity_snapshot = table.Column<string>(type: "text", nullable: true),
                    signer_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    signer_name_snapshot = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    signer_email_snapshot = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    signer_role_snapshot = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    consent_text_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    consent_accepted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    unsigned_document_storage_key = table.Column<string>(type: "text", nullable: true),
                    signed_document_storage_key = table.Column<string>(type: "text", nullable: true),
                    document_sha256_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    verification_code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    signer_ip_hash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    signer_user_agent_summary = table.Column<string>(type: "text", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    sent_to_client_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    signed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    voided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    voided_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    void_reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("service_agreement_pkey", x => x.service_agreement_id);
                    table.CheckConstraint("ck_service_agreement_status", "status IN ('DRAFT','SENT_TO_CLIENT','CHANGE_REQUESTED','ACCEPTED','AWAITING_SIGNATURE','SIGNED','VOID','LEGACY_CONFIRMED')");
                    table.ForeignKey(
                        name: "service_agreement_company_id_fkey",
                        column: x => x.company_id,
                        principalSchema: "public",
                        principalTable: "company",
                        principalColumn: "company_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "service_agreement_created_by_user_id_fkey",
                        column: x => x.created_by_user_id,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "service_agreement_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "public",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "service_agreement_signer_user_id_fkey",
                        column: x => x.signer_user_id,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "service_agreement_voided_by_user_id_fkey",
                        column: x => x.voided_by_user_id,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                },
                comment: "MF-01 Service agreement versions and signing evidence between Client and HR Connect.");

            migrationBuilder.CreateTable(
                name: "service_agreement_signature_challenge",
                schema: "public",
                columns: table => new
                {
                    challenge_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    service_agreement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    signer_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    signer_email_normalized = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    otp_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    max_attempts = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    is_consumed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    consumed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_revoked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("service_agreement_signature_challenge_pkey", x => x.challenge_id);
                    table.ForeignKey(
                        name: "challenge_service_agreement_id_fkey",
                        column: x => x.service_agreement_id,
                        principalSchema: "public",
                        principalTable: "service_agreement",
                        principalColumn: "service_agreement_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "challenge_signer_user_id_fkey",
                        column: x => x.signer_user_id,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_job_current_service_agreement_id",
                schema: "public",
                table: "job",
                column: "current_service_agreement_id");

            migrationBuilder.CreateIndex(
                name: "idx_service_agreement_company_status",
                schema: "public",
                table: "service_agreement",
                columns: new[] { "company_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_service_agreement_created_by_user_id",
                schema: "public",
                table: "service_agreement",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_agreement_signer_user_id",
                schema: "public",
                table: "service_agreement",
                column: "signer_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_service_agreement_voided_by_user_id",
                schema: "public",
                table: "service_agreement",
                column: "voided_by_user_id");

            migrationBuilder.CreateIndex(
                name: "uq_service_agreement_current_job",
                schema: "public",
                table: "service_agreement",
                columns: new[] { "job_id", "is_current" },
                unique: true,
                filter: "is_current = true AND status <> 'VOID'");

            migrationBuilder.CreateIndex(
                name: "uq_service_agreement_job_version",
                schema: "public",
                table: "service_agreement",
                columns: new[] { "job_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_service_agreement_verification_code",
                schema: "public",
                table: "service_agreement",
                column: "verification_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_challenge_agreement_signer",
                schema: "public",
                table: "service_agreement_signature_challenge",
                columns: new[] { "service_agreement_id", "signer_user_id" });

            migrationBuilder.CreateIndex(
                name: "IX_service_agreement_signature_challenge_signer_user_id",
                schema: "public",
                table: "service_agreement_signature_challenge",
                column: "signer_user_id");

            migrationBuilder.AddForeignKey(
                name: "job_current_service_agreement_id_fkey",
                schema: "public",
                table: "job",
                column: "current_service_agreement_id",
                principalSchema: "public",
                principalTable: "service_agreement",
                principalColumn: "service_agreement_id",
                onDelete: ReferentialAction.SetNull);

            // Backfill legacy jobs that already have AgreedAt into LEGACY_CONFIRMED v1 agreement
            migrationBuilder.Sql(@"
                INSERT INTO service_agreement (
                    service_agreement_id,
                    job_id,
                    company_id,
                    version,
                    service_type_code,
                    status,
                    concurrency_token,
                    is_current,
                    fee_multiplier,
                    warranty_days,
                    payment_due_days,
                    price_per_qualified_cv,
                    sourcing_target,
                    review_days,
                    agreement_note,
                    company_name_snapshot,
                    verification_code,
                    created_by_user_id,
                    created_at,
                    signed_at
                )
                SELECT 
                    gen_random_uuid(),
                    j.job_id,
                    j.company_id,
                    1,
                    COALESCE(st.code, 'CV_SOURCING'),
                    'LEGACY_CONFIRMED',
                    gen_random_uuid(),
                    true,
                    j.fee_multiplier,
                    j.warranty_days,
                    j.payment_due_days,
                    j.sourcing_price_per_cv,
                    j.sourcing_target,
                    j.review_days,
                    COALESCE(j.agreement_note, j.agreement_reference),
                    COALESCE(c.company_name, 'Legacy Company'),
                    'LEGACY-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 12)),
                    COALESCE(j.agreed_by, j.created_by),
                    COALESCE(j.agreed_at, j.created_at, now()),
                    j.agreed_at
                FROM job j
                LEFT JOIN service_type st ON j.service_type_id = st.service_type_id
                LEFT JOIN company c ON j.company_id = c.company_id
                WHERE j.agreed_at IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM service_agreement sa WHERE sa.job_id = j.job_id
                  );

                UPDATE job j
                SET current_service_agreement_id = sa.service_agreement_id
                FROM service_agreement sa
                WHERE sa.job_id = j.job_id AND sa.is_current = true
                  AND j.current_service_agreement_id IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "job_current_service_agreement_id_fkey",
                schema: "public",
                table: "job");

            migrationBuilder.DropTable(
                name: "service_agreement_signature_challenge",
                schema: "public");

            migrationBuilder.DropTable(
                name: "service_agreement",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_job_current_service_agreement_id",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "current_service_agreement_id",
                schema: "public",
                table: "job");
        }
    }
}
