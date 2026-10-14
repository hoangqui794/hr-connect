using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSourcingDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The MF-01 columns/tables the model snapshot was missing (AddJobCommercialTerms ..
            // AddJobMaxApplicationsAndPendingPayment) already exist in the database, so only the
            // snapshot is brought up to date here; this migration creates sourcing_delivery only.
            migrationBuilder.CreateTable(
                name: "sourcing_delivery",
                schema: "public",
                columns: table => new
                {
                    delivery_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    delivered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    delivered_by = table.Column<Guid>(type: "uuid", nullable: false),
                    review_due_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    decided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    decided_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reject_reason_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    reject_note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    replaced_by_delivery_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("sourcing_delivery_pkey", x => x.delivery_id);
                    table.CheckConstraint("ck_sourcing_delivery_reject_reason", "reject_reason_code IS NULL OR reject_reason_code IN ('DUPLICATE_ALREADY_OWNED','FALSE_INFORMATION','UNREACHABLE','WRONG_JOB','OTHER')");
                    table.CheckConstraint("ck_sourcing_delivery_review_due", "review_due_at > delivered_at");
                    table.CheckConstraint("ck_sourcing_delivery_status", "status IN ('DELIVERED','ACCEPTED','REJECTED','AUTO_ACCEPTED','REPLACED')");
                    table.ForeignKey(
                        name: "sourcing_delivery_application_id_fkey",
                        column: x => x.application_id,
                        principalSchema: "public",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "sourcing_delivery_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "public",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "MF-03 CV_SOURCING: a qualified CV handed to the Client. Only ACCEPTED and AUTO_ACCEPTED are billed (MF-05).");
            migrationBuilder.CreateIndex(
                name: "idx_sourcing_delivery_job_status",
                schema: "public",
                table: "sourcing_delivery",
                columns: new[] { "job_id", "status" });
            migrationBuilder.CreateIndex(
                name: "idx_sourcing_delivery_status_review_due",
                schema: "public",
                table: "sourcing_delivery",
                columns: new[] { "status", "review_due_at" });
            migrationBuilder.CreateIndex(
                name: "uq_sourcing_delivery_application_active",
                schema: "public",
                table: "sourcing_delivery",
                column: "application_id",
                unique: true,
                filter: "status <> 'REPLACED'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sourcing_delivery",
                schema: "public");
        }
    }
}
