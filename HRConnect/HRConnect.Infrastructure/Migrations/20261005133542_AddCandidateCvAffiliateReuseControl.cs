using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCandidateCvAffiliateReuseControl : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "affiliate_reuse_changed_at",
                schema: "public",
                table: "candidate_cv",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "affiliate_reuse_changed_by_user_id",
                schema: "public",
                table: "candidate_cv",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "affiliate_reuse_concurrency_token",
                schema: "public",
                table: "candidate_cv",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<string>(
                name: "affiliate_reuse_status",
                schema: "public",
                table: "candidate_cv",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            // Existing consent text never granted cross-job reuse. Preserve history,
            // but require an explicit Candidate decision before any future reuse.
            migrationBuilder.Sql(
                "UPDATE public.candidate_cv " +
                "SET affiliate_reuse_status = 'NOT_GRANTED' " +
                "WHERE creation_method = 'AFFILIATE_UPLOAD' AND affiliate_reuse_status IS NULL;");

            migrationBuilder.Sql("""
                INSERT INTO public.permission (code, resource, action, description, is_active, created_at, updated_at)
                VALUES (
                    'cv.affiliate_reuse.manage_own',
                    'candidate_cv',
                    'affiliate_reuse_manage_own',
                    'Manage whether an Affiliate may reuse an uploaded CV for new consent requests',
                    true,
                    now(),
                    now())
                ON CONFLICT (code) DO UPDATE
                SET resource = EXCLUDED.resource,
                    action = EXCLUDED.action,
                    description = EXCLUDED.description,
                    is_active = true,
                    updated_at = now();

                INSERT INTO public.role_permission (role_id, permission_id)
                SELECT r.role_id, p.permission_id
                FROM public.role r
                JOIN public.permission p ON p.code = 'cv.affiliate_reuse.manage_own'
                WHERE r.code = 'CANDIDATE'
                ON CONFLICT (role_id, permission_id) DO NOTHING;
                """);

            migrationBuilder.CreateIndex(
                name: "idx_candidate_cv_affiliate_reuse",
                schema: "public",
                table: "candidate_cv",
                columns: new[] { "uploaded_by_user_id", "affiliate_reuse_status", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_candidate_cv_affiliate_reuse_changed_by_user_id",
                schema: "public",
                table: "candidate_cv",
                column: "affiliate_reuse_changed_by_user_id");

            migrationBuilder.AddCheckConstraint(
                name: "ck_candidate_cv_affiliate_reuse_status",
                schema: "public",
                table: "candidate_cv",
                sql: "((creation_method = 'AFFILIATE_UPLOAD' AND affiliate_reuse_status IN ('NOT_GRANTED','ALLOWED','REVOKED')) OR (creation_method <> 'AFFILIATE_UPLOAD' AND affiliate_reuse_status IS NULL))");

            migrationBuilder.AddForeignKey(
                name: "candidate_cv_reuse_changed_by_user_id_fkey",
                schema: "public",
                table: "candidate_cv",
                column: "affiliate_reuse_changed_by_user_id",
                principalSchema: "public",
                principalTable: "app_user",
                principalColumn: "user_id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM public.role_permission rp
                USING public.role r, public.permission p
                WHERE rp.role_id = r.role_id
                  AND rp.permission_id = p.permission_id
                  AND r.code = 'CANDIDATE'
                  AND p.code = 'cv.affiliate_reuse.manage_own';

                DELETE FROM public.permission
                WHERE code = 'cv.affiliate_reuse.manage_own';
                """);

            migrationBuilder.DropForeignKey(
                name: "candidate_cv_reuse_changed_by_user_id_fkey",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropIndex(
                name: "idx_candidate_cv_affiliate_reuse",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropIndex(
                name: "IX_candidate_cv_affiliate_reuse_changed_by_user_id",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropCheckConstraint(
                name: "ck_candidate_cv_affiliate_reuse_status",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "affiliate_reuse_changed_at",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "affiliate_reuse_changed_by_user_id",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "affiliate_reuse_concurrency_token",
                schema: "public",
                table: "candidate_cv");

            migrationBuilder.DropColumn(
                name: "affiliate_reuse_status",
                schema: "public",
                table: "candidate_cv");
        }
    }
}
