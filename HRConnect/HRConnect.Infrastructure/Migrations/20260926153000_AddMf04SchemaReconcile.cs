using System;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20260926153000_AddMf04SchemaReconcile")]
public partial class AddMf04SchemaReconcile : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1. Offer: Reconcile missing columns & add MF04 fields
        migrationBuilder.AddColumn<string>(
            name: "offer_document_url",
            schema: "public",
            table: "offer",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "sent_at",
            schema: "public",
            table: "offer",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "responded_at",
            schema: "public",
            table: "offer",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "decline_reason",
            schema: "public",
            table: "offer",
            type: "text",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "concurrency_token",
            schema: "public",
            table: "offer",
            type: "uuid",
            nullable: false,
            defaultValueSql: "gen_random_uuid()");

        migrationBuilder.Sql("ALTER TABLE public.offer DROP CONSTRAINT IF EXISTS ck_offer_date_range;");

        // 2. Placement: Reconcile missing columns & FK
        migrationBuilder.AddColumn<Guid>(
            name: "confirmed_by",
            schema: "public",
            table: "placement",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "confirmed_at",
            schema: "public",
            table: "placement",
            type: "timestamp with time zone",
            nullable: false,
            defaultValueSql: "now()");

        migrationBuilder.AddColumn<string>(
            name: "confirmation_note",
            schema: "public",
            table: "placement",
            type: "text",
            nullable: true);

        migrationBuilder.AddForeignKey(
            name: "placement_confirmed_by_fkey",
            schema: "public",
            table: "placement",
            column: "confirmed_by",
            principalSchema: "public",
            principalTable: "app_user",
            principalColumn: "user_id",
            onDelete: ReferentialAction.SetNull);

        // 3. Application: Add planned_start_date and concurrency_token
        migrationBuilder.AddColumn<DateOnly>(
            name: "planned_start_date",
            schema: "public",
            table: "application",
            type: "date",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "concurrency_token",
            schema: "public",
            table: "application",
            type: "uuid",
            nullable: false,
            defaultValueSql: "gen_random_uuid()");

        // 4. Interview: Add recorded_by, recorded_at, concurrency_token & FK
        migrationBuilder.AddColumn<Guid>(
            name: "recorded_by",
            schema: "public",
            table: "interview",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "recorded_at",
            schema: "public",
            table: "interview",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "concurrency_token",
            schema: "public",
            table: "interview",
            type: "uuid",
            nullable: false,
            defaultValueSql: "gen_random_uuid()");

        migrationBuilder.AddForeignKey(
            name: "interview_recorded_by_fkey",
            schema: "public",
            table: "interview",
            column: "recorded_by",
            principalSchema: "public",
            principalTable: "app_user",
            principalColumn: "user_id",
            onDelete: ReferentialAction.SetNull);

        // 5. Create interview_status_history table
        migrationBuilder.CreateTable(
            name: "interview_status_history",
            schema: "public",
            columns: table => new
            {
                interview_status_history_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                interview_id = table.Column<Guid>(type: "uuid", nullable: false),
                old_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                new_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                old_scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                new_scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                changed_by = table.Column<Guid>(type: "uuid", nullable: true),
                reason = table.Column<string>(type: "text", nullable: true),
                changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
            },
            constraints: table =>
            {
                table.PrimaryKey("interview_status_history_pkey", x => x.interview_status_history_id);
                table.ForeignKey(
                    name: "interview_status_history_interview_id_fkey",
                    column: x => x.interview_id,
                    principalSchema: "public",
                    principalTable: "interview",
                    principalColumn: "interview_id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "interview_status_history_changed_by_fkey",
                    column: x => x.changed_by,
                    principalSchema: "public",
                    principalTable: "app_user",
                    principalColumn: "user_id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "idx_interview_status_history_interview",
            schema: "public",
            table: "interview_status_history",
            columns: new[] { "interview_id", "changed_at" },
            descending: new[] { false, true });

        // 6. Create interview_participant table
        migrationBuilder.CreateTable(
            name: "interview_participant",
            schema: "public",
            columns: table => new
            {
                interview_participant_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                interview_id = table.Column<Guid>(type: "uuid", nullable: false),
                user_id = table.Column<Guid>(type: "uuid", nullable: false),
                role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValueSql: "'INTERVIEWER'::character varying"),
                created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
            },
            constraints: table =>
            {
                table.PrimaryKey("interview_participant_pkey", x => x.interview_participant_id);
                table.ForeignKey(
                    name: "interview_participant_interview_id_fkey",
                    column: x => x.interview_id,
                    principalSchema: "public",
                    principalTable: "interview",
                    principalColumn: "interview_id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "interview_participant_user_id_fkey",
                    column: x => x.user_id,
                    principalSchema: "public",
                    principalTable: "app_user",
                    principalColumn: "user_id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "uq_interview_participant_interview_user",
            schema: "public",
            table: "interview_participant",
            columns: new[] { "interview_id", "user_id" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // 6. Drop interview_participant
        migrationBuilder.DropTable(
            name: "interview_participant",
            schema: "public");

        // 5. Drop interview_status_history
        migrationBuilder.DropTable(
            name: "interview_status_history",
            schema: "public");

        // 4. Drop interview additions
        migrationBuilder.DropForeignKey(
            name: "interview_recorded_by_fkey",
            schema: "public",
            table: "interview");

        migrationBuilder.DropColumn(
            name: "recorded_by",
            schema: "public",
            table: "interview");

        migrationBuilder.DropColumn(
            name: "recorded_at",
            schema: "public",
            table: "interview");

        migrationBuilder.DropColumn(
            name: "concurrency_token",
            schema: "public",
            table: "interview");

        // 3. Drop application additions
        migrationBuilder.DropColumn(
            name: "planned_start_date",
            schema: "public",
            table: "application");

        migrationBuilder.DropColumn(
            name: "concurrency_token",
            schema: "public",
            table: "application");

        // 2. Drop placement additions
        migrationBuilder.DropForeignKey(
            name: "placement_confirmed_by_fkey",
            schema: "public",
            table: "placement");

        migrationBuilder.DropColumn(
            name: "confirmed_by",
            schema: "public",
            table: "placement");

        migrationBuilder.DropColumn(
            name: "confirmed_at",
            schema: "public",
            table: "placement");

        migrationBuilder.DropColumn(
            name: "confirmation_note",
            schema: "public",
            table: "placement");

        // 1. Drop offer additions & restore constraint
        migrationBuilder.AddCheckConstraint(
            name: "ck_offer_date_range",
            schema: "public",
            table: "offer",
            sql: "expiry_date IS NULL OR start_date IS NULL OR expiry_date >= start_date");

        migrationBuilder.DropColumn(
            name: "concurrency_token",
            schema: "public",
            table: "offer");

        migrationBuilder.DropColumn(
            name: "decline_reason",
            schema: "public",
            table: "offer");

        migrationBuilder.DropColumn(
            name: "responded_at",
            schema: "public",
            table: "offer");

        migrationBuilder.DropColumn(
            name: "sent_at",
            schema: "public",
            table: "offer");

        migrationBuilder.DropColumn(
            name: "offer_document_url",
            schema: "public",
            table: "offer");
    }
}
