using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Mf05ReplacementSlot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "replacement_slot_id",
                schema: "public",
                table: "submission",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "replacement_slot_id",
                schema: "public",
                table: "placement",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "replacement_slot_id",
                schema: "public",
                table: "application",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "replacement_slot",
                schema: "public",
                columns: table => new
                {
                    replacement_slot_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    original_placement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    service_fee_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    fill_window_days = table.Column<int>(type: "integer", nullable: false),
                    opened_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    filled_by_placement_id = table.Column<Guid>(type: "uuid", nullable: true),
                    closed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    closed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    cancel_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("replacement_slot_pkey", x => x.replacement_slot_id);
                    table.CheckConstraint("ck_replacement_slot_cancel_reason", "status <> 'CANCELLED' OR cancel_reason IS NOT NULL");
                    table.CheckConstraint("ck_replacement_slot_fill_window", "fill_window_days > 0");
                    table.CheckConstraint("ck_replacement_slot_filled", "(status = 'FILLED') = (filled_by_placement_id IS NOT NULL)");
                    table.CheckConstraint("ck_replacement_slot_status", "status IN ('WAITING_PAYMENT','OPEN','FILLED','CANCELLED','EXPIRED')");
                    table.ForeignKey(
                        name: "fk_replacement_slot_filled_by_placement",
                        column: x => x.filled_by_placement_id,
                        principalSchema: "public",
                        principalTable: "placement",
                        principalColumn: "placement_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_replacement_slot_job",
                        column: x => x.job_id,
                        principalSchema: "public",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_replacement_slot_original_placement",
                        column: x => x.original_placement_id,
                        principalSchema: "public",
                        principalTable: "placement",
                        principalColumn: "placement_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_replacement_slot_service_fee",
                        column: x => x.service_fee_id,
                        principalSchema: "public",
                        principalTable: "service_fee",
                        principalColumn: "service_fee_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "MF-05 free replacement hire after a HEADHUNT_COD placement leaves during warranty. One per placement and per service fee.");

            migrationBuilder.CreateIndex(
                name: "idx_submission_replacement_slot_id",
                schema: "public",
                table: "submission",
                column: "replacement_slot_id");

            migrationBuilder.CreateIndex(
                name: "placement_replacement_slot_id_key",
                schema: "public",
                table: "placement",
                column: "replacement_slot_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_application_replacement_slot_id",
                schema: "public",
                table: "application",
                column: "replacement_slot_id");

            migrationBuilder.CreateIndex(
                name: "idx_replacement_slot_job_status_opened",
                schema: "public",
                table: "replacement_slot",
                columns: new[] { "job_id", "status", "opened_at" });

            migrationBuilder.CreateIndex(
                name: "idx_replacement_slot_status_expires",
                schema: "public",
                table: "replacement_slot",
                columns: new[] { "status", "expires_at" });

            migrationBuilder.CreateIndex(
                name: "replacement_slot_filled_by_placement_id_key",
                schema: "public",
                table: "replacement_slot",
                column: "filled_by_placement_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "replacement_slot_original_placement_id_key",
                schema: "public",
                table: "replacement_slot",
                column: "original_placement_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "replacement_slot_service_fee_id_key",
                schema: "public",
                table: "replacement_slot",
                column: "service_fee_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_application_replacement_slot",
                schema: "public",
                table: "application",
                column: "replacement_slot_id",
                principalSchema: "public",
                principalTable: "replacement_slot",
                principalColumn: "replacement_slot_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_placement_replacement_slot",
                schema: "public",
                table: "placement",
                column: "replacement_slot_id",
                principalSchema: "public",
                principalTable: "replacement_slot",
                principalColumn: "replacement_slot_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_submission_replacement_slot",
                schema: "public",
                table: "submission",
                column: "replacement_slot_id",
                principalSchema: "public",
                principalTable: "replacement_slot",
                principalColumn: "replacement_slot_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_application_replacement_slot",
                schema: "public",
                table: "application");

            migrationBuilder.DropForeignKey(
                name: "fk_placement_replacement_slot",
                schema: "public",
                table: "placement");

            migrationBuilder.DropForeignKey(
                name: "fk_submission_replacement_slot",
                schema: "public",
                table: "submission");

            migrationBuilder.DropTable(
                name: "replacement_slot",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "idx_submission_replacement_slot_id",
                schema: "public",
                table: "submission");

            migrationBuilder.DropIndex(
                name: "placement_replacement_slot_id_key",
                schema: "public",
                table: "placement");

            migrationBuilder.DropIndex(
                name: "idx_application_replacement_slot_id",
                schema: "public",
                table: "application");

            migrationBuilder.DropColumn(
                name: "replacement_slot_id",
                schema: "public",
                table: "submission");

            migrationBuilder.DropColumn(
                name: "replacement_slot_id",
                schema: "public",
                table: "placement");

            migrationBuilder.DropColumn(
                name: "replacement_slot_id",
                schema: "public",
                table: "application");
        }
    }
}
