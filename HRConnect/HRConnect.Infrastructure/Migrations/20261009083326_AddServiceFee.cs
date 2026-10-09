using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceFee : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "service_fee",
                schema: "public",
                columns: table => new
                {
                    service_fee_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    placement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    base_salary = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    fee_multiplier = table.Column<decimal>(type: "numeric(6,3)", precision: 6, scale: 3, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false),
                    due_date = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    paid_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    payment_reference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    recorded_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("service_fee_pkey", x => x.service_fee_id);
                    table.CheckConstraint("ck_service_fee_amounts", "amount >= 0 AND base_salary >= 0 AND fee_multiplier > 0");
                    table.CheckConstraint("ck_service_fee_paid", "(status = 'PAID') = (paid_at IS NOT NULL)");
                    table.CheckConstraint("ck_service_fee_status", "status IN ('PENDING','PAID','OVERDUE','CANCELLED')");
                    table.ForeignKey(
                        name: "service_fee_company_id_fkey",
                        column: x => x.company_id,
                        principalSchema: "public",
                        principalTable: "company",
                        principalColumn: "company_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "service_fee_placement_id_fkey",
                        column: x => x.placement_id,
                        principalSchema: "public",
                        principalTable: "placement",
                        principalColumn: "placement_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "MF-05 service fee the Client owes for one HEADHUNT_COD placement. Paid outside the system; Platform Admin records payment.");

            migrationBuilder.CreateIndex(
                name: "idx_service_fee_company_status",
                schema: "public",
                table: "service_fee",
                columns: new[] { "company_id", "status" });

            migrationBuilder.CreateIndex(
                name: "idx_service_fee_status_due_date",
                schema: "public",
                table: "service_fee",
                columns: new[] { "status", "due_date" });

            migrationBuilder.CreateIndex(
                name: "service_fee_placement_id_key",
                schema: "public",
                table: "service_fee",
                column: "placement_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "service_fee",
                schema: "public");
        }
    }
}
