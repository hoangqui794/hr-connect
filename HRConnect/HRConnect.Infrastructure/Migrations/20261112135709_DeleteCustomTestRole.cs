using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DeleteCustomTestRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    target_role_id uuid;
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role') THEN
                        SELECT role_id INTO target_role_id FROM public.role WHERE upper(code) = 'TEST' OR name = 'không có gì' LIMIT 1;
                        IF target_role_id IS NOT NULL THEN
                            DELETE FROM public.role_permission WHERE role_id = target_role_id;
                            DELETE FROM public.user_role WHERE role_id = target_role_id;
                            DELETE FROM public.service_type_allowed_role WHERE role_id = target_role_id;
                            DELETE FROM public.role WHERE role_id = target_role_id;
                        END IF;
                    END IF;

                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
                        SELECT role_id INTO target_role_id FROM public.roles WHERE upper(code) = 'TEST' OR name = 'không có gì' LIMIT 1;
                        IF target_role_id IS NOT NULL THEN
                            DELETE FROM public.role_permissions WHERE role_id = target_role_id;
                            DELETE FROM public.user_roles WHERE role_id = target_role_id;
                            DELETE FROM public.service_type_allowed_roles WHERE role_id = target_role_id;
                            DELETE FROM public.roles WHERE role_id = target_role_id;
                        END IF;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
