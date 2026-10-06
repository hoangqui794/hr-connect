using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateAffiliateCvAdoption : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "candidate_cv_creation_method_check",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_cv_creation_method",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.AddColumn<Guid>(
                name: "adopted_from_cv_id",
                schema: "public",
                table: "candidate_cv",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_candidate_cv_adopted_from",
                schema: "public",
                table: "candidate_cv",
                column: "adopted_from_cv_id",
                unique: true,
                filter: "adopted_from_cv_id IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "candidate_cv_creation_method_check",
                schema: "public",
                table: "candidate_cv",
                sql: "creation_method IN ('PLATFORM_BUILDER','TEMPLATE_FORM','FILE_UPLOAD','AFFILIATE_UPLOAD','AFFILIATE_ADOPTED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_cv_adoption_source",
                schema: "public",
                table: "candidate_cv",
                sql: "((creation_method = 'AFFILIATE_ADOPTED' AND adopted_from_cv_id IS NOT NULL) OR (creation_method <> 'AFFILIATE_ADOPTED' AND adopted_from_cv_id IS NULL))");

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_cv_creation_method",
                schema: "public",
                table: "candidate_cv",
                sql: "((creation_method = 'PLATFORM_BUILDER' AND structured_content IS NOT NULL) OR (creation_method = 'TEMPLATE_FORM' AND structured_content IS NOT NULL AND cv_template_id IS NOT NULL) OR (creation_method IN ('FILE_UPLOAD','AFFILIATE_UPLOAD','AFFILIATE_ADOPTED') AND source_file_url IS NOT NULL))");

            migrationBuilder.AddForeignKey(
                name: "candidate_cv_adopted_from_cv_id_fkey",
                schema: "public",
                table: "candidate_cv",
                column: "adopted_from_cv_id",
                principalSchema: "public",
                principalTable: "candidate_cv",
                principalColumn: "cv_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "candidate_cv_adopted_from_cv_id_fkey",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropIndex(
                name: "ux_candidate_cv_adopted_from",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "candidate_cv_creation_method_check",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_cv_adoption_source",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_cv_creation_method",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "adopted_from_cv_id",
                schema: "public",
                table: "candidate_cv");

            // Preserve the independent personal copies when rolling back to a schema
            // that does not understand adoption provenance.
            migrationBuilder.Sql(
                "UPDATE public.candidate_cv " +
                "SET creation_method = 'FILE_UPLOAD' " +
                "WHERE creation_method = 'AFFILIATE_ADOPTED';");

            migrationBuilder.AddCheckConstraint(
                name: "candidate_cv_creation_method_check",
                schema: "public",
                table: "candidate_cv",
                sql: "creation_method IN ('PLATFORM_BUILDER','TEMPLATE_FORM','FILE_UPLOAD','AFFILIATE_UPLOAD')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_cv_creation_method",
                schema: "public",
                table: "candidate_cv",
                sql: "((creation_method = 'PLATFORM_BUILDER' AND structured_content IS NOT NULL) OR (creation_method = 'TEMPLATE_FORM' AND structured_content IS NOT NULL AND cv_template_id IS NOT NULL) OR (creation_method IN ('FILE_UPLOAD','AFFILIATE_UPLOAD') AND source_file_url IS NOT NULL))");
        }
    }
}
