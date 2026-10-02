using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignAffiliateCvConstraints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Legacy databases contain these constraints from the original SQL schema,
            // while the old EF snapshot did not know about them.
            migrationBuilder.Sql(
                "ALTER TABLE public.candidate_cv DROP CONSTRAINT IF EXISTS candidate_cv_creation_method_check; " +
                "ALTER TABLE public.candidate_cv DROP CONSTRAINT IF EXISTS candidate_cv_status_check; " +
                "ALTER TABLE public.candidate_cv DROP CONSTRAINT IF EXISTS ck_candidate_cv_creation_method;");

            migrationBuilder.AlterTable(
                name: "candidate_cv",
                schema: "public",
                comment: "Supports CVs created by candidates and submission-scoped CVs uploaded by Affiliates.",
                oldComment: "Supports PLATFORM_BUILDER, TEMPLATE_FORM and FILE_UPLOAD CV creation methods.");

            migrationBuilder.AddCheckConstraint(
                name: "candidate_cv_creation_method_check",
                schema: "public",
                table: "candidate_cv",
                sql: "creation_method IN ('PLATFORM_BUILDER','TEMPLATE_FORM','FILE_UPLOAD','AFFILIATE_UPLOAD')");

            migrationBuilder.AddCheckConstraint(
                name: "candidate_cv_status_check",
                schema: "public",
                table: "candidate_cv",
                sql: "status IN ('DRAFT','PENDING_CONSENT','ACTIVE','ARCHIVED','DELETED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_cv_creation_method",
                schema: "public",
                table: "candidate_cv",
                sql: "((creation_method = 'PLATFORM_BUILDER' AND structured_content IS NOT NULL) OR (creation_method = 'TEMPLATE_FORM' AND structured_content IS NOT NULL AND cv_template_id IS NOT NULL) OR (creation_method IN ('FILE_UPLOAD','AFFILIATE_UPLOAD') AND source_file_url IS NOT NULL))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "candidate_cv_creation_method_check",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "candidate_cv_status_check",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_cv_creation_method",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.AddCheckConstraint(
                name: "candidate_cv_creation_method_check",
                schema: "public",
                table: "candidate_cv",
                sql: "creation_method IN ('PLATFORM_BUILDER','TEMPLATE_FORM','FILE_UPLOAD')");

            migrationBuilder.AddCheckConstraint(
                name: "candidate_cv_status_check",
                schema: "public",
                table: "candidate_cv",
                sql: "status IN ('DRAFT','ACTIVE','ARCHIVED')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_cv_creation_method",
                schema: "public",
                table: "candidate_cv",
                sql: "((creation_method = 'PLATFORM_BUILDER' AND structured_content IS NOT NULL) OR " +
                     "(creation_method = 'TEMPLATE_FORM' AND structured_content IS NOT NULL AND cv_template_id IS NOT NULL) OR " +
                     "(creation_method = 'FILE_UPLOAD' AND source_file_url IS NOT NULL))");

            migrationBuilder.AlterTable(
                name: "candidate_cv",
                schema: "public",
                comment: "Supports PLATFORM_BUILDER, TEMPLATE_FORM and FILE_UPLOAD CV creation methods.",
                oldComment: "Supports CVs created by candidates and submission-scoped CVs uploaded by Affiliates.");
        }
    }
}
