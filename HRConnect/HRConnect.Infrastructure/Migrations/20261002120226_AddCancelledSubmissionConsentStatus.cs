using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCancelledSubmissionConsentStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_submission_consent_status",
                schema: "public",
                table: "submission_consent");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submission_consent_status",
                schema: "public",
                table: "submission_consent",
                sql: "status IN ('PENDING','CONFIRMED','DECLINED','EXPIRED','CANCELLED')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_submission_consent_status",
                schema: "public",
                table: "submission_consent");

            migrationBuilder.AddCheckConstraint(
                name: "ck_submission_consent_status",
                schema: "public",
                table: "submission_consent",
                sql: "status IN ('PENDING','CONFIRMED','DECLINED','EXPIRED')");
        }
    }
}
