using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20261009051500_RepairJobStatusHistoryTrigger")]
public partial class RepairJobStatusHistoryTrigger : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE OR REPLACE FUNCTION public.log_job_status_change()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $function$
            BEGIN
                IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
                    INSERT INTO public.job_status_history (
                        job_id,
                        old_status,
                        new_status,
                        changed_by,
                        reason_code,
                        reason_text,
                        changed_at
                    )
                    VALUES (
                        NEW.job_id,
                        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
                        NEW.status,
                        public.current_actor_user_id(),
                        NULL,
                        NEW.status_reason,
                        now()
                    );
                END IF;

                RETURN NEW;
            END;
            $function$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            CREATE OR REPLACE FUNCTION public.log_job_status_change()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $function$
            BEGIN
                IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
                    INSERT INTO public.job_status_history (
                        job_id,
                        old_status,
                        new_status,
                        changed_by,
                        reason,
                        changed_at
                    )
                    VALUES (
                        NEW.job_id,
                        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
                        NEW.status,
                        public.current_actor_user_id(),
                        NEW.status_reason,
                        now()
                    );
                END IF;

                RETURN NEW;
            END;
            $function$;
            """);
    }
}
