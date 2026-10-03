using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnforceCandidateCvUploaderIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_cv_affiliate_uploader",
                schema: "public",
                table: "candidate_cv",
                sql: "creation_method <> 'AFFILIATE_UPLOAD' OR uploaded_by_user_id IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "candidate_cv_uploaded_by_user_id_fkey",
                schema: "public",
                table: "candidate_cv",
                column: "uploaded_by_user_id",
                principalSchema: "public",
                principalTable: "app_user",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "candidate_cv_uploaded_by_user_id_fkey",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_cv_affiliate_uploader",
                schema: "public",
                table: "candidate_cv");
        }
    }
}
