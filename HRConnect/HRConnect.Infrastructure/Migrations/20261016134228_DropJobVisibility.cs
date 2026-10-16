using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropJobVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "idx_job_visibility_status",
                schema: "public",
                table: "job");

            migrationBuilder.DropCheckConstraint(
                name: "ck_job_visibility",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "visibility",
                schema: "public",
                table: "job");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "visibility",
                schema: "public",
                table: "job",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValueSql: "'PUBLIC'::character varying",
                comment: "D07-ready job visibility. Exact actor permissions remain a business-rule/authorization concern.");

            migrationBuilder.CreateIndex(
                name: "idx_job_visibility_status",
                schema: "public",
                table: "job",
                columns: new[] { "visibility", "status", "posted_at" },
                descending: new[] { false, false, true });

            migrationBuilder.AddCheckConstraint(
                name: "ck_job_visibility",
                schema: "public",
                table: "job",
                sql: "visibility IN ('PUBLIC','PARTNER_ONLY','INTERNAL_ONLY')");
        }
    }
}
