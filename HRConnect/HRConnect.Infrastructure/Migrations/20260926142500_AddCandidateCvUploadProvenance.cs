using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260926142500_AddCandidateCvUploadProvenance")]
public partial class AddCandidateCvUploadProvenance : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>(
            name: "uploaded_by_user_id",
            schema: "public",
            table: "candidate_cv",
            type: "uuid",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "idx_candidate_cv_uploaded_by",
            schema: "public",
            table: "candidate_cv",
            column: "uploaded_by_user_id");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "idx_candidate_cv_uploaded_by",
            schema: "public",
            table: "candidate_cv");

        migrationBuilder.DropColumn(
            name: "uploaded_by_user_id",
            schema: "public",
            table: "candidate_cv");
    }
}
