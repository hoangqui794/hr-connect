using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261003190000_AddJobStatusReasonCodes")]
public partial class AddJobStatusReasonCodes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "reason_code",
            schema: "public",
            table: "job_status_history",
            type: "character varying(100)",
            maxLength: 100,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "reason_text",
            schema: "public",
            table: "job_status_history",
            type: "character varying(2000)",
            maxLength: 2000,
            nullable: true);

        migrationBuilder.Sql("UPDATE public.job_status_history SET reason_text = reason WHERE reason IS NOT NULL;");
        migrationBuilder.DropColumn(name: "reason", schema: "public", table: "job_status_history");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "reason",
            schema: "public",
            table: "job_status_history",
            type: "text",
            nullable: true);

        migrationBuilder.Sql("UPDATE public.job_status_history SET reason = reason_text WHERE reason_text IS NOT NULL;");
        migrationBuilder.DropColumn(name: "reason_code", schema: "public", table: "job_status_history");
        migrationBuilder.DropColumn(name: "reason_text", schema: "public", table: "job_status_history");
    }
}
