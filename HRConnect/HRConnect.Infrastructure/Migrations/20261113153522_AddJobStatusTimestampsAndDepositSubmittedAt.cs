using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobStatusTimestampsAndDepositSubmittedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "deposit_submitted_at",
                schema: "public",
                table: "job",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "status_changed_at",
                schema: "public",
                table: "job",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "status_reason_code",
                schema: "public",
                table: "job",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "submitted_at",
                schema: "public",
                table: "job",
                type: "timestamp with time zone",
                nullable: true);

            // Backfill from the status history so existing jobs keep their dates and deposit flag.
            migrationBuilder.Sql(@"
                UPDATE public.job j SET
                    status_changed_at = COALESCE(h.last_changed_at, j.updated_at),
                    status_reason_code = h.last_reason_code
                FROM (
                    SELECT DISTINCT ON (job_id) job_id, changed_at AS last_changed_at, reason_code AS last_reason_code
                    FROM public.job_status_history
                    ORDER BY job_id, changed_at DESC
                ) h
                WHERE h.job_id = j.job_id;

                UPDATE public.job SET status_changed_at = updated_at WHERE status_changed_at IS NULL;

                UPDATE public.job j SET submitted_at = s.submitted_at
                FROM (
                    SELECT job_id, MAX(changed_at) AS submitted_at
                    FROM public.job_status_history
                    WHERE new_status = 'PENDING_REVIEW'
                    GROUP BY job_id
                ) s
                WHERE s.job_id = j.job_id;

                UPDATE public.job j SET deposit_submitted_at = COALESCE(
                    (SELECT MAX(h.changed_at) FROM public.job_status_history h
                     WHERE h.job_id = j.job_id AND h.reason_code = 'DEPOSIT_SUBMITTED'),
                    j.updated_at)
                WHERE EXISTS (SELECT 1 FROM public.job_status_history h
                              WHERE h.job_id = j.job_id AND h.reason_code = 'DEPOSIT_SUBMITTED')
                   OR j.status_reason LIKE '%DEPOSIT_SUBMITTED%'
                   OR j.status_reason LIKE '%Đã nộp cọc%';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "deposit_submitted_at",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "status_changed_at",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "status_reason_code",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "submitted_at",
                schema: "public",
                table: "job");
        }
    }
}
