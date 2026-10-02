using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RepairApplicationStatusConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Some existing databases were created from the legacy SQL schema and still
            // carry application_status_check instead of the EF-managed constraint. Replace
            // either variant so every environment accepts the current application workflow.
            migrationBuilder.Sql("""
                ALTER TABLE public.application
                    DROP CONSTRAINT IF EXISTS application_status_check;

                ALTER TABLE public.application
                    DROP CONSTRAINT IF EXISTS ck_application_status;

                ALTER TABLE public.application
                    ADD CONSTRAINT ck_application_status
                    CHECK (status IN (
                        'SUBMITTED',
                        'SCREENING',
                        'SHORTLISTED',
                        'REJECTED',
                        'INTERVIEW',
                        'BACKUP',
                        'BACKUP_NOT_SELECTED',
                        'INTERVIEW_FAILED',
                        'OFFER_PENDING',
                        'OFFER_ACCEPTED',
                        'OFFER_DECLINED',
                        'NOT_STARTED',
                        'WITHDRAWN',
                        'PLACED',
                        'CLOSED'
                    )) NOT VALID;

                ALTER TABLE public.application
                    VALIDATE CONSTRAINT ck_application_status;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE public.application
                    DROP CONSTRAINT IF EXISTS ck_application_status;

                ALTER TABLE public.application
                    ADD CONSTRAINT application_status_check
                    CHECK (status IN (
                        'SUBMITTED',
                        'SCREENING',
                        'SHORTLISTED',
                        'REJECTED',
                        'INTERVIEW',
                        'BACKUP',
                        'INTERVIEW_FAILED',
                        'OFFER_PENDING',
                        'OFFER_ACCEPTED',
                        'OFFER_DECLINED',
                        'NOT_STARTED',
                        'PLACED',
                        'CLOSED'
                    ));
                """);
        }
    }
}
