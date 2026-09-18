using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignMf04DataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "interview_status_history_interview_id_fkey",
                schema: "hr_connect",
                table: "interview_status_history");

            migrationBuilder.AddForeignKey(
                name: "interview_status_history_interview_id_fkey",
                schema: "hr_connect",
                table: "interview_status_history",
                column: "interview_id",
                principalSchema: "hr_connect",
                principalTable: "interview",
                principalColumn: "interview_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "interview_status_history_interview_id_fkey",
                schema: "hr_connect",
                table: "interview_status_history");

            migrationBuilder.AddForeignKey(
                name: "interview_status_history_interview_id_fkey",
                schema: "hr_connect",
                table: "interview_status_history",
                column: "interview_id",
                principalSchema: "hr_connect",
                principalTable: "interview",
                principalColumn: "interview_id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
