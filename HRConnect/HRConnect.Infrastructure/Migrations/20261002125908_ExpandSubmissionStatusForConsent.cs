using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExpandSubmissionStatusForConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Some environments were initialized from the original SQL schema, where this
            // constraint exists outside EF's model snapshot. Replace it safely in both those
            // databases and databases created only from EF migrations.
            migrationBuilder.Sql(
                "ALTER TABLE public.submission DROP CONSTRAINT IF EXISTS submission_status_check;");

            migrationBuilder.AddCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission",
                sql: "status IN ('RECEIVED','PENDING_CONSENT','ACCEPTED','BLOCKED_DUPLICATE','REJECTED_INVALID','CONSENT_REJECTED','CONSENT_EXPIRED','CANCELLED')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission");

            migrationBuilder.AddCheckConstraint(
                name: "submission_status_check",
                schema: "public",
                table: "submission",
                sql: "status IN ('RECEIVED','ACCEPTED','BLOCKED_DUPLICATE','REJECTED_INVALID','CANCELLED')");
        }
    }
}
