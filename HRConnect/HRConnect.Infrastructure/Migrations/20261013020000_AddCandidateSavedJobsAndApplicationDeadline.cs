using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(HRConnect.Infrastructure.Persistence.ApplicationDbContext))]
[Migration("20261013020000_AddCandidateSavedJobsAndApplicationDeadline")]
public partial class AddCandidateSavedJobsAndApplicationDeadline : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1. Thêm application_deadline vào job table
        migrationBuilder.AddColumn<DateTime>(
            name: "application_deadline",
            schema: "public",
            table: "job",
            type: "timestamp with time zone",
            nullable: true);

        // 2. Tạo index cho job active theo deadline
        migrationBuilder.CreateIndex(
            name: "idx_job_active_deadline",
            schema: "public",
            table: "job",
            columns: new[] { "status", "application_deadline" },
            filter: "((status)::text = 'ACTIVE'::text)");

        // 3. Tạo bảng candidate_saved_job
        migrationBuilder.CreateTable(
            name: "candidate_saved_job",
            schema: "public",
            columns: table => new
            {
                candidate_saved_job_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                job_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
            },
            constraints: table =>
            {
                table.PrimaryKey("candidate_saved_job_pkey", x => x.candidate_saved_job_id);
                table.ForeignKey(
                    name: "candidate_saved_job_candidate_id_fkey",
                    column: x => x.candidate_id,
                    principalSchema: "public",
                    principalTable: "candidate",
                    principalColumn: "candidate_id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "candidate_saved_job_job_id_fkey",
                    column: x => x.job_id,
                    principalSchema: "public",
                    principalTable: "job",
                    principalColumn: "job_id",
                    onDelete: ReferentialAction.Cascade);
            });

        // 4. Tạo unique index (candidate_id, job_id)
        migrationBuilder.CreateIndex(
            name: "uq_candidate_saved_job",
            schema: "public",
            table: "candidate_saved_job",
            columns: new[] { "candidate_id", "job_id" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "candidate_saved_job",
            schema: "public");

        migrationBuilder.DropIndex(
            name: "idx_job_active_deadline",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "application_deadline",
            schema: "public",
            table: "job");
    }
}
