using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

public partial class RestrictInternalHrRecruitmentMutations : Migration
{
    private const string InternalHrMutationPermissions = """
        'application.screen',
        'application.decide_backup',
        'interview.manage',
        'interview.record_result',
        'offer.manage',
        'offer.send',
        'offer.withdraw',
        'placement.manage',
        'placement.confirm',
        'application.mark_not_started'
        """;

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($"""
            DELETE FROM public.role_permission AS role_permission
            USING public.role AS role, public.permission AS permission
            WHERE role_permission.role_id = role.role_id
              AND role_permission.permission_id = permission.permission_id
              AND role.code = 'INTERNAL_HR'
              AND permission.code IN ({InternalHrMutationPermissions});
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql($"""
            INSERT INTO public.role_permission (role_id, permission_id)
            SELECT role.role_id, permission.permission_id
            FROM public.role AS role
            JOIN public.permission AS permission ON permission.code IN ({InternalHrMutationPermissions})
            WHERE role.code = 'INTERNAL_HR'
            ON CONFLICT (role_id, permission_id) DO NOTHING;
            """);
    }
}
