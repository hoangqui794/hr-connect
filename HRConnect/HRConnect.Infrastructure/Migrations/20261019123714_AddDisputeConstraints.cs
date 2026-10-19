using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDisputeConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_dispute_submission_id",
                schema: "public",
                table: "dispute");

            migrationBuilder.CreateIndex(
                name: "idx_dispute_status_created",
                schema: "public",
                table: "dispute",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "uq_dispute_submission_open",
                schema: "public",
                table: "dispute",
                column: "submission_id",
                unique: true,
                filter: "status IN ('OPEN','UNDER_REVIEW')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_dispute_status",
                schema: "public",
                table: "dispute",
                sql: "status IN ('OPEN','UNDER_REVIEW','UPHELD','REJECTED','WITHDRAWN')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_dispute_type",
                schema: "public",
                table: "dispute",
                sql: "dispute_type IN ('DUPLICATE_SUBMISSION','ATTRIBUTION')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "idx_dispute_status_created",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropIndex(
                name: "uq_dispute_submission_open",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropCheckConstraint(
                name: "ck_dispute_status",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropCheckConstraint(
                name: "ck_dispute_type",
                schema: "public",
                table: "dispute");

            migrationBuilder.CreateIndex(
                name: "IX_dispute_submission_id",
                schema: "public",
                table: "dispute",
                column: "submission_id");
        }
    }
}
