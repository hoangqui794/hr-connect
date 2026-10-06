using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignAiMatchCompletedStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ai_match_result_status_check",
                schema: "public",
                table: "ai_match_result");

            migrationBuilder.Sql(
                "UPDATE public.ai_match_result SET status = 'COMPLETED' WHERE status = 'SUCCESS';");

            migrationBuilder.AddCheckConstraint(
                name: "ai_match_result_status_check",
                schema: "public",
                table: "ai_match_result",
                sql: "status IN ('PENDING','PROCESSING','COMPLETED','FAILED','UNAVAILABLE')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ai_match_result_status_check",
                schema: "public",
                table: "ai_match_result");

            migrationBuilder.Sql(
                "UPDATE public.ai_match_result SET status = 'SUCCESS' WHERE status = 'COMPLETED';");

            migrationBuilder.AddCheckConstraint(
                name: "ai_match_result_status_check",
                schema: "public",
                table: "ai_match_result",
                sql: "status IN ('PENDING','PROCESSING','SUCCESS','FAILED','UNAVAILABLE')");
        }
    }
}
