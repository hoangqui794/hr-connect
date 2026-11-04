using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AllowReplacementRefundFee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_service_fee_kind",
                schema: "public",
                table: "service_fee");

            migrationBuilder.AlterTable(
                name: "service_fee",
                schema: "public",
                comment: "MF-05 service fee the Client owes: one HEADHUNT_COD placement (PLACEMENT) or a CV_SOURCING job's DEPOSIT, SETTLEMENT or CREDIT, or a REPLACEMENT_REFUND owed to the Client. Paid outside the system; Platform Admin records payment.",
                oldComment: "MF-05 service fee the Client owes: one HEADHUNT_COD placement (PLACEMENT) or a CV_SOURCING job's DEPOSIT, SETTLEMENT or CREDIT. Paid outside the system; Platform Admin records payment.");

            migrationBuilder.AddCheckConstraint(
                name: "ck_service_fee_kind",
                schema: "public",
                table: "service_fee",
                sql: "kind IN ('PLACEMENT','DEPOSIT','SETTLEMENT','CREDIT','REPLACEMENT_REFUND')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_service_fee_kind",
                schema: "public",
                table: "service_fee");

            migrationBuilder.AlterTable(
                name: "service_fee",
                schema: "public",
                comment: "MF-05 service fee the Client owes: one HEADHUNT_COD placement (PLACEMENT) or a CV_SOURCING job's DEPOSIT, SETTLEMENT or CREDIT. Paid outside the system; Platform Admin records payment.",
                oldComment: "MF-05 service fee the Client owes: one HEADHUNT_COD placement (PLACEMENT) or a CV_SOURCING job's DEPOSIT, SETTLEMENT or CREDIT, or a REPLACEMENT_REFUND owed to the Client. Paid outside the system; Platform Admin records payment.");

            migrationBuilder.AddCheckConstraint(
                name: "ck_service_fee_kind",
                schema: "public",
                table: "service_fee",
                sql: "kind IN ('PLACEMENT','DEPOSIT','SETTLEMENT','CREDIT')");
        }
    }
}
