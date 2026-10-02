using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmissionCandidateConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "submission_consent",
                schema: "public",
                columns: table => new
                {
                    consent_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recipient_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    requested_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    response_ip = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    response_user_agent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    email_send_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    email_sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_email_error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("submission_consent_pkey", x => x.consent_id);
                    table.CheckConstraint("ck_submission_consent_expiry", "expires_at > requested_at");
                    table.CheckConstraint("ck_submission_consent_status", "status IN ('PENDING','CONFIRMED','DECLINED','EXPIRED')");
                    table.ForeignKey(
                        name: "submission_consent_submission_id_fkey",
                        column: x => x.submission_id,
                        principalSchema: "public",
                        principalTable: "submission",
                        principalColumn: "submission_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "uq_submission_one_pending_consent",
                schema: "public",
                table: "submission",
                columns: new[] { "job_id", "candidate_id" },
                unique: true,
                filter: "((status)::text = 'PENDING_CONSENT'::text)");

            migrationBuilder.CreateIndex(
                name: "idx_submission_consent_pending_expiry",
                schema: "public",
                table: "submission_consent",
                columns: new[] { "status", "expires_at" },
                filter: "status = 'PENDING'");

            migrationBuilder.CreateIndex(
                name: "uq_submission_consent_submission",
                schema: "public",
                table: "submission_consent",
                column: "submission_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_submission_consent_token_hash",
                schema: "public",
                table: "submission_consent",
                column: "token_hash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "submission_consent",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "uq_submission_one_pending_consent",
                schema: "public",
                table: "submission");
        }
    }
}
