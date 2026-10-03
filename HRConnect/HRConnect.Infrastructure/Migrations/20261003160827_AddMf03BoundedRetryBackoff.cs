using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMf03BoundedRetryBackoff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "next_attempt_at",
                schema: "public",
                table: "ai_match_result",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "idx_ai_match_result_pending_dispatch",
                schema: "public",
                table: "ai_match_result",
                columns: new[] { "status", "next_attempt_at" },
                filter: "status = 'PENDING'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "idx_ai_match_result_pending_dispatch",
                schema: "public",
                table: "ai_match_result");

            migrationBuilder.DropColumn(
                name: "next_attempt_at",
                schema: "public",
                table: "ai_match_result");
        }
    }
}
