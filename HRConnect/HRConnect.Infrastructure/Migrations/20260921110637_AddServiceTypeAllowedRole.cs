using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceTypeAllowedRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "service_type_allowed_role",
                schema: "public",
                columns: table => new
                {
                    service_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    can_view = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    can_submit = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("service_type_allowed_role_pkey", x => new { x.service_type_id, x.role_id });
                    table.ForeignKey(
                        name: "service_type_allowed_role_role_id_fkey",
                        column: x => x.role_id,
                        principalSchema: "public",
                        principalTable: "role",
                        principalColumn: "role_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "service_type_allowed_role_service_type_id_fkey",
                        column: x => x.service_type_id,
                        principalSchema: "public",
                        principalTable: "service_type",
                        principalColumn: "service_type_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_service_type_allowed_role_view",
                schema: "public",
                table: "service_type_allowed_role",
                columns: new[] { "role_id", "can_view" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "service_type_allowed_role",
                schema: "public");
        }
    }
}
