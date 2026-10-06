using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ExpandNotificationTypeForSubmissionConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE public.notification
                DROP CONSTRAINT IF EXISTS ck_notification_type;

                ALTER TABLE public.notification
                ADD CONSTRAINT ck_notification_type CHECK (
                    notification_type IN (
                        'ACCOUNT', 'COMPANY', 'JOB', 'SUBMISSION',
                        'SUBMISSION_CONSENT_RESULT', 'JOB_FIT', 'APPLICATION_STATUS',
                        'INTERVIEW', 'OFFER', 'AFFILIATE', 'COMMISSION', 'PAYOUT', 'SYSTEM'
                    )
                );
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE public.notification
                DROP CONSTRAINT IF EXISTS ck_notification_type;

                ALTER TABLE public.notification
                ADD CONSTRAINT ck_notification_type CHECK (
                    notification_type IN (
                        'ACCOUNT', 'COMPANY', 'JOB', 'SUBMISSION', 'JOB_FIT',
                        'APPLICATION_STATUS', 'INTERVIEW', 'OFFER', 'AFFILIATE',
                        'COMMISSION', 'PAYOUT', 'SYSTEM'
                    )
                );
                """);
        }
    }
}
