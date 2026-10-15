using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Mf05InWarrantyAndDueStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_service_fee_status",
                schema: "public",
                table: "service_fee");

            migrationBuilder.AddCheckConstraint(
                name: "ck_service_fee_status",
                schema: "public",
                table: "service_fee",
                sql: "status IN ('PENDING','DUE','PAID','OVERDUE','CANCELLED')");

            // MF-05 E3: a started candidate's commission is IN_WARRANTY; ON_HOLD now only means a resignation under review.
            migrationBuilder.Sql("""
                UPDATE public.commission c
                SET status = 'IN_WARRANTY', updated_at = now()
                FROM public.warranty w
                WHERE w.placement_id = c.placement_id
                  AND w.status = 'ACTIVE'
                  AND c.status = 'ON_HOLD';

                UPDATE public.commission c
                SET status = 'IN_WARRANTY', updated_at = now()
                FROM public.placement p
                WHERE p.placement_id = c.placement_id
                  AND p.status = 'STARTED'
                  AND c.status = 'PENDING';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE public.service_fee SET status = 'PENDING', updated_at = now() WHERE status = 'DUE';
                UPDATE public.commission SET status = 'ON_HOLD', updated_at = now() WHERE status = 'IN_WARRANTY';
                """);

            migrationBuilder.DropCheckConstraint(
                name: "ck_service_fee_status",
                schema: "public",
                table: "service_fee");

            migrationBuilder.AddCheckConstraint(
                name: "ck_service_fee_status",
                schema: "public",
                table: "service_fee",
                sql: "status IN ('PENDING','PAID','OVERDUE','CANCELLED')");
        }
    }
}
