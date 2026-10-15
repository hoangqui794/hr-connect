using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMf02ClientOwnership : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission");

            migrationBuilder.AddCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission",
                sql: "status IN ('RECEIVED','PENDING_CONSENT','ACCEPTED','BLOCKED_DUPLICATE','BLOCKED_CLIENT_OWNED','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED')");

            migrationBuilder.CreateIndex(
                name: "idx_application_candidate_applied_at",
                schema: "public",
                table: "application",
                columns: new[] { "candidate_id", "applied_at" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission");

            migrationBuilder.DropIndex(
                name: "idx_application_candidate_applied_at",
                schema: "public",
                table: "application");

            migrationBuilder.AddCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission",
                sql: "status IN ('RECEIVED','PENDING_CONSENT','ACCEPTED','BLOCKED_DUPLICATE','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED')");
        }
    }
}
