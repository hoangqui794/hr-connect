using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobProposedAndAgreedCommercialTerms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "agreed_at",
                schema: "public",
                table: "job",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "agreed_by",
                schema: "public",
                table: "job",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "agreement_note",
                schema: "public",
                table: "job",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "agreement_reference",
                schema: "public",
                table: "job",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "deposit_percent",
                schema: "public",
                table: "job",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "proposed_fee_multiplier",
                schema: "public",
                table: "job",
                type: "numeric(5,2)",
                precision: 5,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "proposed_fee_note",
                schema: "public",
                table: "job",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "proposed_payment_due_days",
                schema: "public",
                table: "job",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "proposed_price_per_cv",
                schema: "public",
                table: "job",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "proposed_warranty_days",
                schema: "public",
                table: "job",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "review_days",
                schema: "public",
                table: "job",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_job_agreed_by",
                schema: "public",
                table: "job",
                column: "agreed_by");

            migrationBuilder.AddForeignKey(
                name: "job_agreed_by_fkey",
                schema: "public",
                table: "job",
                column: "agreed_by",
                principalSchema: "public",
                principalTable: "app_user",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "job_agreed_by_fkey",
                schema: "public",
                table: "job");

            migrationBuilder.DropIndex(
                name: "IX_job_agreed_by",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "agreed_at",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "agreed_by",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "agreement_note",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "agreement_reference",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "deposit_percent",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "proposed_fee_multiplier",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "proposed_fee_note",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "proposed_payment_due_days",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "proposed_price_per_cv",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "proposed_warranty_days",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "review_days",
                schema: "public",
                table: "job");
        }
    }
}
