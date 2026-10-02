using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

public partial class AddJobWorkingTimeAndRemoveJobLocations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // The previous local-only migration created this experimental table.
        // IF EXISTS keeps both the development database and fresh installations safe.
        migrationBuilder.Sql("DROP TABLE IF EXISTS public.job_location;");
        migrationBuilder.Sql("ALTER TABLE public.job ADD COLUMN IF NOT EXISTS working_time character varying(2000);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE public.job DROP COLUMN IF EXISTS working_time;");
    }
}
