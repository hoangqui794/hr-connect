using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(HRConnect.Infrastructure.Persistence.ApplicationDbContext))]
[Migration("20261012170000_AddCandidateCareerFields")]
public partial class AddCandidateCareerFields : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "current_job_title",
            schema: "public",
            table: "candidate",
            type: "character varying(150)",
            maxLength: 150,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "current_level",
            schema: "public",
            table: "candidate",
            type: "character varying(50)",
            maxLength: 50,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "target_role",
            schema: "public",
            table: "candidate",
            type: "character varying(150)",
            maxLength: 150,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "expected_salary_min",
            schema: "public",
            table: "candidate",
            type: "numeric(18,2)",
            precision: 18,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "expected_salary_max",
            schema: "public",
            table: "candidate",
            type: "numeric(18,2)",
            precision: 18,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "expected_salary_currency",
            schema: "public",
            table: "candidate",
            type: "character varying(10)",
            maxLength: 10,
            nullable: true,
            defaultValueSql: "'VND'::character varying");

        migrationBuilder.AddColumn<DateOnly>(
            name: "available_from",
            schema: "public",
            table: "candidate",
            type: "date",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "preferred_locations",
            schema: "public",
            table: "candidate",
            type: "character varying(255)",
            maxLength: 255,
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "preferred_work_modes",
            schema: "public",
            table: "candidate",
            type: "character varying(100)",
            maxLength: 100,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "preferred_work_modes",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "preferred_locations",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "available_from",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "expected_salary_currency",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "expected_salary_max",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "expected_salary_min",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "target_role",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "current_level",
            schema: "public",
            table: "candidate");

        migrationBuilder.DropColumn(
            name: "current_job_title",
            schema: "public",
            table: "candidate");
    }
}
