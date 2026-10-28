using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

public partial class SupportDecimalExperienceYears : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE public.job ALTER COLUMN min_experience_years TYPE numeric(4,1);");
        migrationBuilder.Sql("ALTER TABLE public.job ALTER COLUMN max_experience_years TYPE numeric(4,1);");
        migrationBuilder.Sql("ALTER TABLE public.job_template ALTER COLUMN min_experience_years TYPE numeric(4,1);");
        migrationBuilder.Sql("ALTER TABLE public.job_template ALTER COLUMN max_experience_years TYPE numeric(4,1);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("ALTER TABLE public.job ALTER COLUMN min_experience_years TYPE integer;");
        migrationBuilder.Sql("ALTER TABLE public.job ALTER COLUMN max_experience_years TYPE integer;");
        migrationBuilder.Sql("ALTER TABLE public.job_template ALTER COLUMN min_experience_years TYPE integer;");
        migrationBuilder.Sql("ALTER TABLE public.job_template ALTER COLUMN max_experience_years TYPE integer;");
    }
}
