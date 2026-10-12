using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "system_setting",
                schema: "public",
                columns: table => new
                {
                    setting_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    value = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("system_setting_pkey", x => x.setting_key);
                    table.ForeignKey(
                        name: "system_setting_updated_by_fkey",
                        column: x => x.updated_by,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                },
                comment: "Admin overrides of configurable business numbers. Keys, defaults and ranges are declared in code (BusinessSettingKeys); no row means the documented default applies.");

            migrationBuilder.CreateIndex(
                name: "IX_system_setting_updated_by",
                schema: "public",
                table: "system_setting",
                column: "updated_by");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "system_setting",
                schema: "public");
        }
    }
}
