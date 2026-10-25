using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCompanyLogoStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "logo_object_key",
                schema: "public",
                table: "company",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "logo_updated_at",
                schema: "public",
                table: "company",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "logo_url",
                schema: "public",
                table: "company",
                type: "character varying(2048)",
                maxLength: 2048,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "logo_object_key",
                schema: "public",
                table: "company");

            migrationBuilder.DropColumn(
                name: "logo_updated_at",
                schema: "public",
                table: "company");

            migrationBuilder.DropColumn(
                name: "logo_url",
                schema: "public",
                table: "company");
        }
    }
}
