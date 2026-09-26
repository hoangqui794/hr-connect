using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260926144500_AddLoginLockout")]
public partial class AddLoginLockout : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "failed_login_attempts",
            schema: "public",
            table: "app_user",
            type: "integer",
            nullable: false,
            defaultValue: 0);

        migrationBuilder.AddColumn<DateTime>(
            name: "lockout_end_at",
            schema: "public",
            table: "app_user",
            type: "timestamp with time zone",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "failed_login_attempts", schema: "public", table: "app_user");
        migrationBuilder.DropColumn(name: "lockout_end_at", schema: "public", table: "app_user");
    }
}
