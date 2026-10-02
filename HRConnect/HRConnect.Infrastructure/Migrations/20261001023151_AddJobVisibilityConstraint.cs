using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobVisibilityConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Some databases created the legacy constraint outside EF migrations.
            // Replace it deterministically so migration history and schema converge.
            migrationBuilder.Sql(
                "ALTER TABLE public.job DROP CONSTRAINT IF EXISTS ck_job_visibility;");

            migrationBuilder.AddCheckConstraint(
                name: "ck_job_visibility",
                schema: "public",
                table: "job",
                sql: "visibility IN ('PUBLIC','PARTNER_ONLY','INTERNAL_ONLY')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_job_visibility",
                schema: "public",
                table: "job");
        }
    }
}
