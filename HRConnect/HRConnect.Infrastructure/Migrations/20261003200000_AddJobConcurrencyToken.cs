using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

public partial class AddJobConcurrencyToken : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.AddColumn<Guid>(
        name: "concurrency_token", schema: "public", table: "job", type: "uuid", nullable: false,
        defaultValueSql: "gen_random_uuid()");

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropColumn(
        name: "concurrency_token", schema: "public", table: "job");
}
