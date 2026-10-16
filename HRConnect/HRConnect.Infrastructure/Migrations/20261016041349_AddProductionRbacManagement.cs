using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductionRbacManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "grant_source",
                schema: "public",
                table: "role_permission",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "SYSTEM_MIGRATION");

            migrationBuilder.AddColumn<Guid>(
                name: "granted_by",
                schema: "public",
                table: "role_permission",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "concurrency_token",
                schema: "public",
                table: "role",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<Guid>(
                name: "concurrency_token",
                schema: "public",
                table: "permission",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.AddColumn<bool>(
                name: "is_delegable",
                schema: "public",
                table: "permission",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "authorization_concurrency_token",
                schema: "public",
                table: "app_user",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.Sql("""
                INSERT INTO public.role (role_id, code, name, description, is_system, is_active, created_at, updated_at, concurrency_token)
                VALUES
                    (gen_random_uuid(), 'CANDIDATE', 'Candidate', 'Ứng viên tìm việc', true, true, now(), now(), gen_random_uuid()),
                    (gen_random_uuid(), 'AFFILIATE_RECRUITER', 'Affiliate Recruiter', 'Đối tác tuyển dụng / Cộng tác viên', true, true, now(), now(), gen_random_uuid()),
                    (gen_random_uuid(), 'CLIENT_COMPANY_USER', 'Client Company User', 'Người đại diện doanh nghiệp tuyển dụng', true, true, now(), now(), gen_random_uuid()),
                    (gen_random_uuid(), 'INTERNAL_HR', 'Internal HR', 'Nhân sự nội bộ HRConnect', true, true, now(), now(), gen_random_uuid()),
                    (gen_random_uuid(), 'PLATFORM_ADMIN', 'Platform Admin', 'Quản trị viên toàn hệ thống', true, true, now(), now(), gen_random_uuid())
                ON CONFLICT (code) DO UPDATE
                SET name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    is_system = true,
                    updated_at = now();
                """);

            migrationBuilder.Sql(HRConnect.Infrastructure.Persistence.DatabaseSeeder.EmbeddedPermissionSeedSql);

            migrationBuilder.Sql("""
                UPDATE public.user_role
                SET status = CASE WHEN upper(trim(status)) = 'REVOKED' THEN 'REVOKED' ELSE 'ACTIVE' END;

                UPDATE public.user_role
                SET revoked_at = NULL,
                    revoked_by = NULL,
                    revoke_reason = NULL
                WHERE status = 'ACTIVE';

                UPDATE public.user_role
                SET revoked_at = COALESCE(revoked_at, now()),
                    revoke_reason = COALESCE(NULLIF(trim(revoke_reason), ''), 'Migrated legacy revoked assignment')
                WHERE status = 'REVOKED';

                UPDATE public.permission
                SET is_delegable = false,
                    concurrency_token = gen_random_uuid(),
                    updated_at = now()
                WHERE code IN ('role.manage', 'permission.manage', 'user.manage', 'system_config.manage', 'audit.view');
                """);

            migrationBuilder.AddCheckConstraint(
                name: "ck_user_role_lifecycle",
                schema: "public",
                table: "user_role",
                sql: "(status = 'ACTIVE' AND revoked_at IS NULL AND revoked_by IS NULL AND revoke_reason IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL AND length(trim(revoke_reason)) > 0)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_user_role_status",
                schema: "public",
                table: "user_role",
                sql: "status IN ('ACTIVE','REVOKED')");

            migrationBuilder.CreateIndex(
                name: "IX_role_permission_granted_by",
                schema: "public",
                table: "role_permission",
                column: "granted_by");

            migrationBuilder.AddForeignKey(
                name: "role_permission_granted_by_fkey",
                schema: "public",
                table: "role_permission",
                column: "granted_by",
                principalSchema: "public",
                principalTable: "app_user",
                principalColumn: "user_id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "role_permission_granted_by_fkey",
                schema: "public",
                table: "role_permission");

            migrationBuilder.DropCheckConstraint(
                name: "ck_user_role_lifecycle",
                schema: "public",
                table: "user_role");

            migrationBuilder.DropCheckConstraint(
                name: "ck_user_role_status",
                schema: "public",
                table: "user_role");

            migrationBuilder.DropIndex(
                name: "IX_role_permission_granted_by",
                schema: "public",
                table: "role_permission");

            migrationBuilder.DropColumn(
                name: "grant_source",
                schema: "public",
                table: "role_permission");

            migrationBuilder.DropColumn(
                name: "granted_by",
                schema: "public",
                table: "role_permission");

            migrationBuilder.DropColumn(
                name: "concurrency_token",
                schema: "public",
                table: "role");

            migrationBuilder.DropColumn(
                name: "concurrency_token",
                schema: "public",
                table: "permission");

            migrationBuilder.DropColumn(
                name: "is_delegable",
                schema: "public",
                table: "permission");

            migrationBuilder.DropColumn(
                name: "authorization_concurrency_token",
                schema: "public",
                table: "app_user");
        }
    }
}
