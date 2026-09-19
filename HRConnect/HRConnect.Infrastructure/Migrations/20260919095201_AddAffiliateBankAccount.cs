using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAffiliateBankAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "bank_account_holder",
                schema: "public",
                table: "affiliate_profile",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bank_account_number",
                schema: "public",
                table: "affiliate_profile",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bank_branch",
                schema: "public",
                table: "affiliate_profile",
                type: "character varying(180)",
                maxLength: 180,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "bank_name",
                schema: "public",
                table: "affiliate_profile",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "bank_account_holder",
                schema: "public",
                table: "affiliate_profile");

            migrationBuilder.DropColumn(
                name: "bank_account_number",
                schema: "public",
                table: "affiliate_profile");

            migrationBuilder.DropColumn(
                name: "bank_branch",
                schema: "public",
                table: "affiliate_profile");

            migrationBuilder.DropColumn(
                name: "bank_name",
                schema: "public",
                table: "affiliate_profile");
        }
    }
}
