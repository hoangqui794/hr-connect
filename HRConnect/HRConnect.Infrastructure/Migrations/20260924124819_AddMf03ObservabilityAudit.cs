using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMf03ObservabilityAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "dispatch_count",
                schema: "public",
                table: "ai_match_result",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "failure_code",
                schema: "public",
                table: "ai_match_result",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_dispatched_at",
                schema: "public",
                table: "ai_match_result",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "model_version",
                schema: "public",
                table: "ai_match_result",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "processing_started_at",
                schema: "public",
                table: "ai_match_result",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "dispatch_count",
                schema: "public",
                table: "ai_match_result");

            migrationBuilder.DropColumn(
                name: "failure_code",
                schema: "public",
                table: "ai_match_result");

            migrationBuilder.DropColumn(
                name: "last_dispatched_at",
                schema: "public",
                table: "ai_match_result");

            migrationBuilder.DropColumn(
                name: "model_version",
                schema: "public",
                table: "ai_match_result");

            migrationBuilder.DropColumn(
                name: "processing_started_at",
                schema: "public",
                table: "ai_match_result");
        }
    }
}
