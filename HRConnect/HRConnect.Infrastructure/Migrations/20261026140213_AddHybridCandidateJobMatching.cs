using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHybridCandidateJobMatching : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "dismissed_at",
                schema: "public",
                table: "candidate_job_match",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "input_fingerprint",
                schema: "public",
                table: "candidate_job_match",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_attempt_at",
                schema: "public",
                table: "candidate_job_match",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "next_retry_at",
                schema: "public",
                table: "candidate_job_match",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "retry_count",
                schema: "public",
                table: "candidate_job_match",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "scoring_version",
                schema: "public",
                table: "candidate_job_match",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "idx_candidate_job_match_feed",
                schema: "public",
                table: "candidate_job_match",
                columns: new[] { "candidate_id", "status", "generated_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "ux_candidate_job_match_input",
                schema: "public",
                table: "candidate_job_match",
                columns: new[] { "candidate_id", "job_id", "input_fingerprint" },
                unique: true,
                filter: "input_fingerprint IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "idx_candidate_job_match_feed",
                schema: "public",
                table: "candidate_job_match");

            migrationBuilder.DropIndex(
                name: "ux_candidate_job_match_input",
                schema: "public",
                table: "candidate_job_match");

            migrationBuilder.DropColumn(
                name: "dismissed_at",
                schema: "public",
                table: "candidate_job_match");

            migrationBuilder.DropColumn(
                name: "input_fingerprint",
                schema: "public",
                table: "candidate_job_match");

            migrationBuilder.DropColumn(
                name: "last_attempt_at",
                schema: "public",
                table: "candidate_job_match");

            migrationBuilder.DropColumn(
                name: "next_retry_at",
                schema: "public",
                table: "candidate_job_match");

            migrationBuilder.DropColumn(
                name: "retry_count",
                schema: "public",
                table: "candidate_job_match");

            migrationBuilder.DropColumn(
                name: "scoring_version",
                schema: "public",
                table: "candidate_job_match");
        }
    }
}
