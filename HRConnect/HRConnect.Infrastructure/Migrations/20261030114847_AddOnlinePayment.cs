using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOnlinePayment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "online_payment",
                schema: "public",
                columns: table => new
                {
                    online_payment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    target_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    target_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency_code = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false, defaultValue: "VND"),
                    txn_ref = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "PENDING"),
                    provider_transaction_no = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    bank_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    response_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    last_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    paid_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("online_payment_pkey", x => x.online_payment_id);
                    table.CheckConstraint("ck_online_payment_amount", "amount > 0");
                    table.CheckConstraint("ck_online_payment_status", "status IN ('PENDING','PROCESSING','SUCCEEDED','FAILED','NEEDS_REVIEW')");
                    table.CheckConstraint("ck_online_payment_target_type", "target_type IN ('SERVICE_FEE','POSTING_FEE')");
                });

            migrationBuilder.CreateIndex(
                name: "idx_online_payment_target",
                schema: "public",
                table: "online_payment",
                columns: new[] { "target_type", "target_id" });

            migrationBuilder.CreateIndex(
                name: "uq_online_payment_txn_ref",
                schema: "public",
                table: "online_payment",
                column: "txn_ref",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "online_payment",
                schema: "public");
        }
    }
}
