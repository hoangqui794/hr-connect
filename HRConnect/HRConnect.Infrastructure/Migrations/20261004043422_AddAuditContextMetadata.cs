using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditContextMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "audit_log_actor_user_id_fkey",
                schema: "public",
                table: "audit_log");

            migrationBuilder.AlterTable(
                name: "audit_log",
                schema: "public",
                comment: "Append-only audit trail with actor and source context.",
                oldComment: "Append-only audit trail. Set hr_connect.current_user_id in the application transaction when actor identity is available.");

            migrationBuilder.AddColumn<string>(
                name: "actor_type",
                schema: "public",
                table: "audit_log",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "SYSTEM");

            migrationBuilder.AddColumn<int>(
                name: "event_version",
                schema: "public",
                table: "audit_log",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<string>(
                name: "service_name",
                schema: "public",
                table: "audit_log",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source",
                schema: "public",
                table: "audit_log",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "APPLICATION");

            migrationBuilder.Sql("""
                -- Databases built only from EF migrations do not have this trigger.
                DO $guard$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_trigger
                        WHERE tgname = 'trg_audit_log_no_update'
                          AND tgrelid = 'public.audit_log'::regclass
                    ) THEN
                        ALTER TABLE public.audit_log DISABLE TRIGGER trg_audit_log_no_update;
                    END IF;
                END
                $guard$;

                UPDATE public.audit_log
                SET actor_type = CASE
                        WHEN actor_user_id IS NOT NULL THEN 'USER'
                        WHEN action IN ('INSERT', 'UPDATE', 'DELETE') THEN 'DATABASE_TRIGGER'
                        WHEN action LIKE 'AI_SCORING_%' THEN 'SERVICE'
                        WHEN ip_address IS NOT NULL OR user_agent IS NOT NULL OR correlation_id IS NOT NULL THEN 'ANONYMOUS'
                        ELSE 'SYSTEM'
                    END,
                    source = CASE
                        WHEN action IN ('INSERT', 'UPDATE', 'DELETE') THEN 'DATABASE_TRIGGER'
                        WHEN action IN ('AI_SCORING_REQUESTED', 'AI_SCORING_RETRY_REQUESTED', 'AI_SCORING_COMPLETED') THEN 'INTEGRATION'
                        WHEN action = 'AI_SCORING_RETRY_SCHEDULED' THEN 'BACKGROUND_WORKER'
                        WHEN action = 'AI_SCORING_FAILED'
                             AND COALESCE(new_values ->> 'failureCode', '') LIKE '%RETRY_EXHAUSTED' THEN 'BACKGROUND_WORKER'
                        WHEN action = 'AI_SCORING_FAILED' THEN 'INTEGRATION'
                        WHEN ip_address IS NOT NULL OR user_agent IS NOT NULL OR correlation_id IS NOT NULL THEN 'API'
                        WHEN actor_user_id IS NOT NULL THEN 'APPLICATION'
                        ELSE 'BACKGROUND_WORKER'
                    END,
                    service_name = CASE
                        WHEN action IN ('INSERT', 'UPDATE', 'DELETE') THEN 'POSTGRESQL_TRIGGER'
                        WHEN action IN ('AI_SCORING_REQUESTED', 'AI_SCORING_RETRY_REQUESTED') THEN 'MF02_MF03_TRIGGER'
                        WHEN action = 'AI_SCORING_RETRY_SCHEDULED' THEN 'MF03_DISPATCHER'
                        WHEN action = 'AI_SCORING_FAILED'
                             AND COALESCE(new_values ->> 'failureCode', '') LIKE '%RETRY_EXHAUSTED' THEN 'MF03_DISPATCHER'
                        WHEN action IN ('AI_SCORING_COMPLETED', 'AI_SCORING_FAILED') THEN 'MF03'
                        ELSE NULL
                    END,
                    event_version = 1;

                -- Databases built only from EF migrations do not have this trigger.
                DO $guard$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_trigger
                        WHERE tgname = 'trg_audit_log_no_update'
                          AND tgrelid = 'public.audit_log'::regclass
                    ) THEN
                        ALTER TABLE public.audit_log ENABLE TRIGGER trg_audit_log_no_update;
                    END IF;
                END
                $guard$;

                CREATE OR REPLACE FUNCTION public.audit_business_row_change()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $function$
                DECLARE
                    v_old jsonb;
                    v_new jsonb;
                    v_id uuid;
                    v_actor uuid;
                    v_correlation uuid;
                    v_ip inet;
                    v_user_agent text;
                BEGIN
                    IF TG_OP = 'INSERT' THEN
                        v_old := NULL;
                        v_new := to_jsonb(NEW);
                        v_id := (v_new ->> TG_ARGV[1])::uuid;
                    ELSIF TG_OP = 'UPDATE' THEN
                        v_old := to_jsonb(OLD);
                        v_new := to_jsonb(NEW);
                        v_id := (v_new ->> TG_ARGV[1])::uuid;
                    ELSE
                        v_old := to_jsonb(OLD);
                        v_new := NULL;
                        v_id := (v_old ->> TG_ARGV[1])::uuid;
                    END IF;

                    v_actor := current_actor_user_id();
                    BEGIN
                        v_correlation := NULLIF(current_setting('app.correlation_id', true), '')::uuid;
                    EXCEPTION WHEN others THEN
                        v_correlation := NULL;
                    END;
                    BEGIN
                        v_ip := NULLIF(current_setting('app.ip_address', true), '')::inet;
                    EXCEPTION WHEN others THEN
                        v_ip := NULL;
                    END;
                    v_user_agent := NULLIF(current_setting('app.user_agent', true), '');

                    INSERT INTO public.audit_log(
                        actor_user_id,
                        actor_type,
                        action,
                        source,
                        service_name,
                        event_version,
                        entity_type,
                        entity_id,
                        old_values,
                        new_values,
                        correlation_id,
                        ip_address,
                        user_agent,
                        created_at
                    )
                    VALUES (
                        v_actor,
                        CASE WHEN v_actor IS NULL THEN 'DATABASE_TRIGGER' ELSE 'USER' END,
                        TG_OP,
                        'DATABASE_TRIGGER',
                        'POSTGRESQL_TRIGGER',
                        1,
                        TG_ARGV[0],
                        v_id,
                        v_old,
                        v_new,
                        v_correlation,
                        v_ip,
                        v_user_agent,
                        now()
                    );

                    IF TG_OP = 'DELETE' THEN
                        RETURN OLD;
                    END IF;
                    RETURN NEW;
                END;
                $function$;
                """);

            migrationBuilder.CreateIndex(
                name: "idx_audit_log_actor_type",
                schema: "public",
                table: "audit_log",
                columns: new[] { "actor_type", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "idx_audit_log_service",
                schema: "public",
                table: "audit_log",
                columns: new[] { "service_name", "created_at" },
                descending: new[] { false, true },
                filter: "service_name IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "idx_audit_log_source",
                schema: "public",
                table: "audit_log",
                columns: new[] { "source", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.AddCheckConstraint(
                name: "audit_log_actor_type_check",
                schema: "public",
                table: "audit_log",
                sql: "actor_type IN ('USER', 'ANONYMOUS', 'SYSTEM', 'SERVICE', 'DATABASE_TRIGGER')");

            migrationBuilder.AddCheckConstraint(
                name: "audit_log_actor_identity_check",
                schema: "public",
                table: "audit_log",
                sql: "(actor_user_id IS NULL AND actor_type <> 'USER') OR (actor_user_id IS NOT NULL AND actor_type = 'USER')");

            migrationBuilder.AddCheckConstraint(
                name: "audit_log_event_version_check",
                schema: "public",
                table: "audit_log",
                sql: "event_version >= 1");

            migrationBuilder.AddCheckConstraint(
                name: "audit_log_source_check",
                schema: "public",
                table: "audit_log",
                sql: "source IN ('API', 'APPLICATION', 'BACKGROUND_WORKER', 'INTEGRATION', 'DATABASE_TRIGGER')");

            migrationBuilder.AddCheckConstraint(
                name: "audit_log_service_actor_check",
                schema: "public",
                table: "audit_log",
                sql: "actor_type <> 'SERVICE' OR service_name IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "audit_log_actor_user_id_fkey",
                schema: "public",
                table: "audit_log",
                column: "actor_user_id",
                principalSchema: "public",
                principalTable: "app_user",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION public.audit_business_row_change()
                RETURNS trigger
                LANGUAGE plpgsql
                AS $function$
                DECLARE
                    v_old jsonb;
                    v_new jsonb;
                    v_id uuid;
                BEGIN
                    IF TG_OP = 'INSERT' THEN
                        v_old := NULL;
                        v_new := to_jsonb(NEW);
                        v_id := (v_new ->> TG_ARGV[1])::uuid;
                    ELSIF TG_OP = 'UPDATE' THEN
                        v_old := to_jsonb(OLD);
                        v_new := to_jsonb(NEW);
                        v_id := (v_new ->> TG_ARGV[1])::uuid;
                    ELSE
                        v_old := to_jsonb(OLD);
                        v_new := NULL;
                        v_id := (v_old ->> TG_ARGV[1])::uuid;
                    END IF;

                    INSERT INTO public.audit_log(
                        actor_user_id, action, entity_type, entity_id,
                        old_values, new_values, created_at
                    )
                    VALUES (
                        current_actor_user_id(), TG_OP, TG_ARGV[0], v_id,
                        v_old, v_new, now()
                    );

                    IF TG_OP = 'DELETE' THEN
                        RETURN OLD;
                    END IF;
                    RETURN NEW;
                END;
                $function$;
                """);

            migrationBuilder.DropForeignKey(
                name: "audit_log_actor_user_id_fkey",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropIndex(
                name: "idx_audit_log_actor_type",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropIndex(
                name: "idx_audit_log_service",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropIndex(
                name: "idx_audit_log_source",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropCheckConstraint(
                name: "audit_log_actor_type_check",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropCheckConstraint(
                name: "audit_log_actor_identity_check",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropCheckConstraint(
                name: "audit_log_event_version_check",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropCheckConstraint(
                name: "audit_log_source_check",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropCheckConstraint(
                name: "audit_log_service_actor_check",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropColumn(
                name: "actor_type",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropColumn(
                name: "event_version",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropColumn(
                name: "service_name",
                schema: "public",
                table: "audit_log");

            migrationBuilder.DropColumn(
                name: "source",
                schema: "public",
                table: "audit_log");

            migrationBuilder.AlterTable(
                name: "audit_log",
                schema: "public",
                comment: "Append-only audit trail. Set hr_connect.current_user_id in the application transaction when actor identity is available.",
                oldComment: "Append-only audit trail with actor and source context.");

            migrationBuilder.AddForeignKey(
                name: "audit_log_actor_user_id_fkey",
                schema: "public",
                table: "audit_log",
                column: "actor_user_id",
                principalSchema: "public",
                principalTable: "app_user",
                principalColumn: "user_id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
