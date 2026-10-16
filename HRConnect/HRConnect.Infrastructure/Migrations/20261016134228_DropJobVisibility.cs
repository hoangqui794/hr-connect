using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <summary>
    /// Job access is decided by service_type_allowed_role (can_view / can_submit), so the per-job
    /// visibility column goes away. The trigger added by FixJobVisibilityMatrix fires on
    /// "UPDATE OF ... visibility" and therefore depends on the column; it must be dropped first.
    /// </summary>
    public partial class DropJobVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER IF EXISTS trg_job_visibility_matrix ON public.job;
                DROP FUNCTION IF EXISTS public.enforce_job_visibility_matrix();
                DROP INDEX IF EXISTS public.idx_job_visibility_status;
                ALTER TABLE public.job DROP CONSTRAINT IF EXISTS ck_job_visibility;
                ALTER TABLE public.job DROP COLUMN IF EXISTS visibility;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "visibility",
                schema: "public",
                table: "job",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValueSql: "'PUBLIC'::character varying",
                comment: "D07-ready job visibility. Exact actor permissions remain a business-rule/authorization concern.");

            // Restore the values the old matrix required before re-adding its guards.
            migrationBuilder.Sql("""
                UPDATE public.job j
                SET visibility = 'PARTNER_ONLY'
                FROM public.service_type s
                WHERE j.service_type_id = s.service_type_id
                  AND s.code IN ('CV_SOURCING', 'HEADHUNT_COD');
                """);

            migrationBuilder.CreateIndex(
                name: "idx_job_visibility_status",
                schema: "public",
                table: "job",
                columns: new[] { "visibility", "status", "posted_at" },
                descending: new[] { false, false, true });

            migrationBuilder.AddCheckConstraint(
                name: "ck_job_visibility",
                schema: "public",
                table: "job",
                sql: "visibility IN ('PUBLIC','PARTNER_ONLY','INTERNAL_ONLY')");

            migrationBuilder.Sql("""
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
    }
}
