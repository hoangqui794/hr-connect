using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261009223000_FixJobVisibilityMatrix")]
public partial class FixJobVisibilityMatrix : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            -- 1. Cập nhật dữ liệu seed cũ bị sai ma trận: CV_SOURCING và HEADHUNT_COD phải là PARTNER_ONLY
            UPDATE public.job j
            SET visibility = 'PARTNER_ONLY', updated_at = now()
            FROM public.service_type s
            WHERE j.service_type_id = s.service_type_id
              AND s.code IN ('CV_SOURCING', 'HEADHUNT_COD')
              AND j.visibility = 'PUBLIC';

            -- 2. Hàm và Trigger bảo đảm toàn vẹn ma trận visibility x service_type
            CREATE OR REPLACE FUNCTION public.enforce_job_visibility_matrix()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $function$
            DECLARE
                v_service_code text;
            BEGIN
                SELECT code INTO v_service_code
                FROM public.service_type
                WHERE service_type_id = NEW.service_type_id;

                IF v_service_code = 'CV_APPLICATION' AND NEW.visibility NOT IN ('PUBLIC', 'INTERNAL_ONLY') THEN
                    RAISE EXCEPTION 'CV_APPLICATION chỉ cho phép visibility là PUBLIC hoặc INTERNAL_ONLY. Hiện tại: %', NEW.visibility;
                ELSIF v_service_code IN ('CV_SOURCING', 'HEADHUNT_COD') AND NEW.visibility NOT IN ('PARTNER_ONLY', 'INTERNAL_ONLY') THEN
                    RAISE EXCEPTION '% chỉ cho phép visibility là PARTNER_ONLY hoặc INTERNAL_ONLY. Hiện tại: %', v_service_code, NEW.visibility;
                END IF;

                RETURN NEW;
            END;
            $function$;

            DROP TRIGGER IF EXISTS trg_job_visibility_matrix ON public.job;
            CREATE TRIGGER trg_job_visibility_matrix
            BEFORE INSERT OR UPDATE OF service_type_id, visibility ON public.job
            FOR EACH ROW
            EXECUTE FUNCTION public.enforce_job_visibility_matrix();
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TRIGGER IF EXISTS trg_job_visibility_matrix ON public.job;
            DROP FUNCTION IF EXISTS public.enforce_job_visibility_matrix();
            """);
    }
}
