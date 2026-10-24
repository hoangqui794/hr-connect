using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlacementReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "placement_reconciliation",
                schema: "public",
                columns: table => new
                {
                    reconciliation_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    placement_id = table.Column<Guid>(type: "uuid", nullable: true),
                    claimed_outcome = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    contact_channel = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    resolution_note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    concurrency_token = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("placement_reconciliation_pkey", x => x.reconciliation_id);
                    table.CheckConstraint("ck_placement_reconciliation_channel", "contact_channel IS NULL OR contact_channel IN ('CANDIDATE','AFFILIATE','BOTH')");
                    table.CheckConstraint("ck_placement_reconciliation_flag_note", "status <> 'FLAGGED' OR length(trim(note)) > 0");
                    table.CheckConstraint("ck_placement_reconciliation_outcome", "claimed_outcome IN ('STARTED','NOT_STARTED')");
                    table.CheckConstraint("ck_placement_reconciliation_placement", "(claimed_outcome = 'STARTED' AND placement_id IS NOT NULL) OR (claimed_outcome = 'NOT_STARTED' AND placement_id IS NULL)");
                    table.CheckConstraint("ck_placement_reconciliation_review", "(status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status <> 'PENDING' AND reviewed_at IS NOT NULL)");
                    table.CheckConstraint("ck_placement_reconciliation_status", "status IN ('PENDING','CONFIRMED','FLAGGED')");
                    table.ForeignKey(
                        name: "fk_placement_reconciliation_application",
                        column: x => x.application_id,
                        principalSchema: "public",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_placement_reconciliation_placement",
                        column: x => x.placement_id,
                        principalSchema: "public",
                        principalTable: "placement",
                        principalColumn: "placement_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_placement_reconciliation_reviewer",
                        column: x => x.reviewed_by,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "UC-41 operational verification of HEADHUNT_COD start-work outcomes before placement finance proceeds.");

            migrationBuilder.CreateIndex(
                name: "idx_placement_reconciliation_status_created",
                schema: "public",
                table: "placement_reconciliation",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_placement_reconciliation_reviewed_by",
                schema: "public",
                table: "placement_reconciliation",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "placement_reconciliation_application_id_key",
                schema: "public",
                table: "placement_reconciliation",
                column: "application_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "placement_reconciliation_placement_id_key",
                schema: "public",
                table: "placement_reconciliation",
                column: "placement_id",
                unique: true);

            // Existing production rows predate UC-41. Confirm them so current fees are not
            // unexpectedly blocked by the new gate. New outcomes are always PENDING.
            migrationBuilder.Sql("""
                INSERT INTO public.placement_reconciliation
                    (reconciliation_id, application_id, placement_id, claimed_outcome, status,
                     note, reviewed_at, concurrency_token, created_at, updated_at)
                SELECT gen_random_uuid(), a.application_id, p.placement_id, 'STARTED', 'CONFIRMED',
                       'LEGACY_BACKFILL', now(), gen_random_uuid(), now(), now()
                FROM public.placement p
                JOIN public.application a ON a.application_id = p.application_id
                JOIN public.job j ON j.job_id = a.job_id
                JOIN public.service_type st ON st.service_type_id = j.service_type_id
                WHERE st.code = 'HEADHUNT_COD'
                ON CONFLICT (application_id) DO NOTHING;

                INSERT INTO public.placement_reconciliation
                    (reconciliation_id, application_id, placement_id, claimed_outcome, status,
                     note, reviewed_at, concurrency_token, created_at, updated_at)
                SELECT gen_random_uuid(), a.application_id, NULL, 'NOT_STARTED', 'CONFIRMED',
                       'LEGACY_BACKFILL', now(), gen_random_uuid(), now(), now()
                FROM public.application a
                JOIN public.job j ON j.job_id = a.job_id
                JOIN public.service_type st ON st.service_type_id = j.service_type_id
                WHERE st.code = 'HEADHUNT_COD' AND a.status = 'NOT_STARTED'
                ON CONFLICT (application_id) DO NOTHING;

                INSERT INTO public.permission
                    (code, resource, action, description, is_active, is_delegable, created_at, updated_at)
                VALUES
                    ('placement.reconcile', 'placement', 'reconcile',
                     'Verify HEADHUNT_COD start-work outcomes before placement finance proceeds',
                     true, false, now(), now())
                ON CONFLICT (code) DO UPDATE
                SET resource = EXCLUDED.resource,
                    action = EXCLUDED.action,
                    description = EXCLUDED.description,
                    is_active = true,
                    is_delegable = false,
                    updated_at = now();

                INSERT INTO public.role_permission
                    (role_id, permission_id, granted_at, grant_source)
                SELECT r.role_id, p.permission_id, now(), 'SYSTEM_MIGRATION'
                FROM public.role r
                JOIN public.permission p ON p.code = 'placement.reconcile'
                WHERE r.code = 'INTERNAL_HR'
                ON CONFLICT (role_id, permission_id) DO NOTHING;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM public.role_permission rp
                USING public.permission p
                WHERE rp.permission_id = p.permission_id
                  AND p.code = 'placement.reconcile';

                DELETE FROM public.permission WHERE code = 'placement.reconcile';
                """);

            migrationBuilder.DropTable(
                name: "placement_reconciliation",
                schema: "public");
        }
    }
}
