using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AllowFinanceNotificationTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_notification_type",
                schema: "public",
                table: "notification");

            migrationBuilder.AddCheckConstraint(
                name: "ck_notification_type",
                schema: "public",
                table: "notification",
                sql: "notification_type IN ('ACCOUNT','COMPANY','JOB','SUBMISSION','SUBMISSION_CONSENT_RESULT','JOB_FIT','APPLICATION_STATUS','INTERVIEW','OFFER','AFFILIATE','COMMISSION','PAYOUT','SYSTEM','SERVICE_FEE','WARRANTY','SOURCING')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The old constraint cannot hold rows of the new types.
            migrationBuilder.Sql("DELETE FROM public.notification WHERE notification_type IN ('SERVICE_FEE','WARRANTY','SOURCING');");

            migrationBuilder.DropCheckConstraint(
                name: "ck_notification_type",
                schema: "public",
                table: "notification");

            migrationBuilder.AddCheckConstraint(
                name: "ck_notification_type",
                schema: "public",
                table: "notification",
                sql: "notification_type IN ('ACCOUNT','COMPANY','JOB','SUBMISSION','SUBMISSION_CONSENT_RESULT','JOB_FIT','APPLICATION_STATUS','INTERVIEW','OFFER','AFFILIATE','COMMISSION','PAYOUT','SYSTEM')");
        }
    }
}
