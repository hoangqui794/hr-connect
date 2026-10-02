using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

public partial class AddJobExperienceAndSalaryNegotiation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE public.job ADD COLUMN IF NOT EXISTS min_experience_years integer;");
        migrationBuilder.Sql("ALTER TABLE public.job ADD COLUMN IF NOT EXISTS max_experience_years integer;");
        migrationBuilder.Sql("ALTER TABLE public.job ADD COLUMN IF NOT EXISTS salary_negotiable boolean NOT NULL DEFAULT FALSE;");
        migrationBuilder.Sql("ALTER TABLE public.job ADD COLUMN IF NOT EXISTS salary_note character varying(1000);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE public.job DROP COLUMN IF EXISTS min_experience_years;");
        migrationBuilder.Sql("ALTER TABLE public.job DROP COLUMN IF EXISTS max_experience_years;");
        migrationBuilder.Sql("ALTER TABLE public.job DROP COLUMN IF EXISTS salary_negotiable;");
        migrationBuilder.Sql("ALTER TABLE public.job DROP COLUMN IF EXISTS salary_note;");
    }
}
