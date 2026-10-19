using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ProductionAvatarStorage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "avatar_object_key",
                schema: "public",
                table: "app_user",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "avatar_updated_at",
                schema: "public",
                table: "app_user",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE public.app_user
                SET avatar_object_key = avatar_url,
                    avatar_updated_at = COALESCE(updated_at, now()),
                    avatar_url = NULL
                WHERE avatar_url LIKE 'avatars/%';
                """);

            migrationBuilder.CreateTable(
                name: "storage_cleanup_job",
                schema: "public",
                columns: table => new
                {
                    storage_cleanup_job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    object_key = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    reason = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "PENDING"),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    next_attempt_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    processing_started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("storage_cleanup_job_pkey", x => x.storage_cleanup_job_id);
                    table.CheckConstraint("ck_storage_cleanup_job_avatar_namespace", "object_key LIKE 'avatars/%'");
                    table.CheckConstraint("ck_storage_cleanup_job_status", "status IN ('PENDING','PROCESSING','COMPLETED','FAILED','DEAD')");
                    table.ForeignKey(
                        name: "storage_cleanup_job_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "public",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "idx_storage_cleanup_job_due",
                schema: "public",
                table: "storage_cleanup_job",
                columns: new[] { "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "IX_storage_cleanup_job_user_id",
                schema: "public",
                table: "storage_cleanup_job",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_storage_cleanup_job_active_key",
                schema: "public",
                table: "storage_cleanup_job",
                column: "object_key",
                unique: true,
                filter: "status IN ('PENDING','PROCESSING','FAILED')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "storage_cleanup_job",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "avatar_object_key",
                schema: "public",
                table: "app_user");

            migrationBuilder.DropColumn(
                name: "avatar_updated_at",
                schema: "public",
                table: "app_user");
        }
    }
}
