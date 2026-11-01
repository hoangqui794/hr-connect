using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class HardenVnPayPaymentProcessing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Keep the newest active attempt per payable target before enforcing the invariant.
            // Older links can no longer be trusted once another active attempt exists.
            migrationBuilder.Sql(
                """
                WITH ranked AS (
                    SELECT online_payment_id,
                           ROW_NUMBER() OVER (
                               PARTITION BY target_type, target_id
                               ORDER BY (status = 'PROCESSING') DESC, updated_at DESC, created_at DESC, online_payment_id DESC) AS rn
                    FROM public.online_payment
                    WHERE status IN ('PENDING', 'PROCESSING')
                )
                UPDATE public.online_payment AS payment
                SET status = 'FAILED',
                    last_error = 'Phiên thanh toán cũ được đóng khi nâng cấp cơ chế chống thanh toán trùng.',
                    updated_at = now()
                FROM ranked
                WHERE payment.online_payment_id = ranked.online_payment_id
                  AND ranked.rn > 1;
                """);

            migrationBuilder.CreateIndex(
                name: "uq_online_payment_active_target",
                schema: "public",
                table: "online_payment",
                columns: new[] { "target_type", "target_id" },
                unique: true,
                filter: "status IN ('PENDING','PROCESSING')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uq_online_payment_active_target",
                schema: "public",
                table: "online_payment");
        }
    }
}
