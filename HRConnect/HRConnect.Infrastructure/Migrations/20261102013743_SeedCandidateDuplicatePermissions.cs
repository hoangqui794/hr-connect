using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SeedCandidateDuplicatePermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO public.permission
                    (code, resource, action, description, is_active, created_at, updated_at)
                VALUES
                    (
                        'candidate_duplicate.view',
                        'candidate_duplicate',
                        'view',
                        'View Candidate duplicate review cases',
                        true,
                        now(),
                        now()
                    ),
                    (
                        'candidate_duplicate.resolve',
                        'candidate_duplicate',
                        'resolve',
                        'Resolve and merge Candidate duplicate cases',
                        true,
                        now(),
                        now()
                    )
                ON CONFLICT (code) DO UPDATE
                SET resource = EXCLUDED.resource,
                    action = EXCLUDED.action,
                    description = EXCLUDED.description,
                    is_active = true,
                    updated_at = now();

                INSERT INTO public.role_permission (role_id, permission_id)
                SELECT role.role_id, permission.permission_id
                FROM public.role AS role
                CROSS JOIN public.permission AS permission
                WHERE role.code = 'PLATFORM_ADMIN'
                  AND permission.code IN (
                      'candidate_duplicate.view',
                      'candidate_duplicate.resolve'
                  )
                ON CONFLICT (role_id, permission_id) DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM public.role_permission AS role_permission
                USING public.role AS role, public.permission AS permission
                WHERE role_permission.role_id = role.role_id
                  AND role_permission.permission_id = permission.permission_id
                  AND role.code = 'PLATFORM_ADMIN'
                  AND permission.code IN (
                      'candidate_duplicate.view',
                      'candidate_duplicate.resolve'
                  );

                DELETE FROM public.permission
                WHERE code IN (
                    'candidate_duplicate.view',
                    'candidate_duplicate.resolve'
                );
                """);
        }
    }
}
