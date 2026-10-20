using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class HardenDisputeResolution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "resolution_idempotency_key",
                schema: "public",
                table: "dispute",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "uq_dispute_resolution_idempotency",
                schema: "public",
                table: "dispute",
                column: "resolution_idempotency_key",
                unique: true,
                filter: "resolution_idempotency_key IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "uq_dispute_resolution_idempotency",
                schema: "public",
                table: "dispute");

            migrationBuilder.DropColumn(
                name: "resolution_idempotency_key",
                schema: "public",
                table: "dispute");
        }
    }
}
