using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261008090000_EnforceSingleScheduledInterview")]
public partial class EnforceSingleScheduledInterview : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateIndex(
            name: "ux_interview_one_scheduled_per_application",
            schema: "public",
            table: "interview",
            column: "application_id",
            unique: true,
            filter: "status = 'SCHEDULED'");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "ux_interview_one_scheduled_per_application",
            schema: "public",
            table: "interview");
    }
}
