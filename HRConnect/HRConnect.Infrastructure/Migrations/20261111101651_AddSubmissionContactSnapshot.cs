using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmissionContactSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "normalized_submitted_phone",
                schema: "public",
                table: "submission",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "submitted_full_name",
                schema: "public",
                table: "submission",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "submitted_phone",
                schema: "public",
                table: "submission",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "normalized_submitted_phone",
                schema: "public",
                table: "submission");

            migrationBuilder.DropColumn(
                name: "submitted_full_name",
                schema: "public",
                table: "submission");

            migrationBuilder.DropColumn(
                name: "submitted_phone",
                schema: "public",
                table: "submission");
        }
    }
}
