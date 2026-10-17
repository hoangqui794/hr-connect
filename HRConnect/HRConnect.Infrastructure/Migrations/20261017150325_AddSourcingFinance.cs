using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSourcingFinance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterTable(
                name: "service_fee",
                schema: "public",
                comment: "MF-05 service fee the Client owes: one HEADHUNT_COD placement (PLACEMENT) or a CV_SOURCING job's DEPOSIT, SETTLEMENT or CREDIT. Paid outside the system; Platform Admin records payment.",
                oldComment: "MF-05 service fee the Client owes for one HEADHUNT_COD placement. Paid outside the system; Platform Admin records payment.");

            migrationBuilder.AlterColumn<Guid>(
                name: "placement_id",
                schema: "public",
                table: "service_fee",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "job_id",
                schema: "public",
                table: "service_fee",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                schema: "public",
                table: "service_fee",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValueSql: "'PLACEMENT'::character varying");

            migrationBuilder.AlterColumn<Guid>(
                name: "placement_id",
                schema: "public",
                table: "commission",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AlterColumn<Guid>(
                name: "commission_rule_id",
                schema: "public",
                table: "commission",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "sourcing_delivery_id",
                schema: "public",
                table: "commission",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "uq_service_fee_job_closing",
                schema: "public",
                table: "service_fee",
                column: "job_id",
                unique: true,
                filter: "kind IN ('SETTLEMENT','CREDIT')");

            migrationBuilder.CreateIndex(
                name: "uq_service_fee_job_deposit",
                schema: "public",
                table: "service_fee",
                column: "job_id",
                unique: true,
                filter: "kind = 'DEPOSIT'");

            migrationBuilder.AddCheckConstraint(
                name: "ck_service_fee_kind",
                schema: "public",
                table: "service_fee",
                sql: "kind IN ('PLACEMENT','DEPOSIT','SETTLEMENT','CREDIT')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_service_fee_source",
                schema: "public",
                table: "service_fee",
                sql: "(kind = 'PLACEMENT' AND placement_id IS NOT NULL) OR (kind <> 'PLACEMENT' AND placement_id IS NULL AND job_id IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "uq_commission_sourcing_delivery",
                schema: "public",
                table: "commission",
                column: "sourcing_delivery_id",
                unique: true,
                filter: "sourcing_delivery_id IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_commission_source",
                schema: "public",
                table: "commission",
                sql: "(placement_id IS NULL) <> (sourcing_delivery_id IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "commission_sourcing_delivery_id_fkey",
                schema: "public",
                table: "commission",
                column: "sourcing_delivery_id",
                principalSchema: "public",
                principalTable: "sourcing_delivery",
                principalColumn: "delivery_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "service_fee_job_id_fkey",
                schema: "public",
                table: "service_fee",
                column: "job_id",
                principalSchema: "public",
                principalTable: "job",
                principalColumn: "job_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // CV_SOURCING finance rows cannot exist without the new columns: remove them (and their
            // payouts, adjustments and disputes) before placement_id becomes NOT NULL again.
            migrationBuilder.Sql(@"
DELETE FROM public.payout WHERE commission_id IN (SELECT commission_id FROM public.commission WHERE sourcing_delivery_id IS NOT NULL);
DELETE FROM public.commission_adjustment WHERE commission_id IN (SELECT commission_id FROM public.commission WHERE sourcing_delivery_id IS NOT NULL);
DELETE FROM public.dispute WHERE commission_id IN (SELECT commission_id FROM public.commission WHERE sourcing_delivery_id IS NOT NULL);
DELETE FROM public.commission WHERE sourcing_delivery_id IS NOT NULL;
DELETE FROM public.service_fee WHERE kind <> 'PLACEMENT';");

            migrationBuilder.DropForeignKey(
                name: "commission_sourcing_delivery_id_fkey",
                schema: "public",
                table: "commission");

            migrationBuilder.DropForeignKey(
                name: "service_fee_job_id_fkey",
                schema: "public",
                table: "service_fee");

            migrationBuilder.DropIndex(
                name: "uq_service_fee_job_closing",
                schema: "public",
                table: "service_fee");

            migrationBuilder.DropIndex(
                name: "uq_service_fee_job_deposit",
                schema: "public",
                table: "service_fee");

            migrationBuilder.DropCheckConstraint(
                name: "ck_service_fee_kind",
                schema: "public",
                table: "service_fee");

            migrationBuilder.DropCheckConstraint(
                name: "ck_service_fee_source",
                schema: "public",
                table: "service_fee");

            migrationBuilder.DropIndex(
                name: "uq_commission_sourcing_delivery",
                schema: "public",
                table: "commission");

            migrationBuilder.DropCheckConstraint(
                name: "ck_commission_source",
                schema: "public",
                table: "commission");

            migrationBuilder.DropColumn(
                name: "job_id",
                schema: "public",
                table: "service_fee");

            migrationBuilder.DropColumn(
                name: "kind",
                schema: "public",
                table: "service_fee");

            migrationBuilder.DropColumn(
                name: "sourcing_delivery_id",
                schema: "public",
                table: "commission");

            migrationBuilder.AlterTable(
                name: "service_fee",
                schema: "public",
                comment: "MF-05 service fee the Client owes for one HEADHUNT_COD placement. Paid outside the system; Platform Admin records payment.",
                oldComment: "MF-05 service fee the Client owes: one HEADHUNT_COD placement (PLACEMENT) or a CV_SOURCING job's DEPOSIT, SETTLEMENT or CREDIT. Paid outside the system; Platform Admin records payment.");

            migrationBuilder.AlterColumn<Guid>(
                name: "placement_id",
                schema: "public",
                table: "service_fee",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "placement_id",
                schema: "public",
                table: "commission",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "commission_rule_id",
                schema: "public",
                table: "commission",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
