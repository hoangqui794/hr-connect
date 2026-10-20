using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateDuplicateResolutionIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "resolution_idempotency_key",
                schema: "public",
                table: "candidate_duplicate_case",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "uq_candidate_duplicate_case_resolution_idempotency",
                schema: "public",
                table: "candidate_duplicate_case",
                column: "resolution_idempotency_key",
                unique: true,
                filter: "resolution_idempotency_key IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uq_candidate_duplicate_case_resolution_idempotency",
                schema: "public",
                table: "candidate_duplicate_case");

            migrationBuilder.DropColumn(
                name: "resolution_idempotency_key",
                schema: "public",
                table: "candidate_duplicate_case");
        }
    }
}
