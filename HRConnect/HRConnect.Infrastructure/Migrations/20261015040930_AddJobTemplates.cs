using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddJobTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "template_id",
                schema: "public",
                table: "job",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "job_template",
                schema: "public",
                columns: table => new
                {
                    template_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    industry = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    level = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    keywords = table.Column<string>(type: "text", nullable: true),
                    summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    benefits = table.Column<string>(type: "text", nullable: true),
                    employment_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    min_experience_years = table.Column<int>(type: "integer", nullable: true),
                    max_experience_years = table.Column<int>(type: "integer", nullable: true),
                    search_text = table.Column<string>(type: "text", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    usage_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    concurrency_token = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("job_template_pkey", x => x.template_id);
                    table.CheckConstraint("ck_job_template_experience", "min_experience_years IS NULL OR max_experience_years IS NULL OR min_experience_years <= max_experience_years");
                    table.CheckConstraint("ck_job_template_usage", "usage_count >= 0");
                },
                comment: "MF-01: shared JD templates a Client can start a job from. Managed by Internal HR / Admin.");

            migrationBuilder.CreateTable(
                name: "job_template_requirement",
                schema: "public",
                columns: table => new
                {
                    template_requirement_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    template_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requirement_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    category = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    content = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("job_template_requirement_pkey", x => x.template_requirement_id);
                    table.CheckConstraint("ck_job_template_requirement_type", "requirement_type IN ('MUST_HAVE','SHOULD_HAVE')");
                    table.ForeignKey(
                        name: "job_template_requirement_template_id_fkey",
                        column: x => x.template_id,
                        principalSchema: "public",
                        principalTable: "job_template",
                        principalColumn: "template_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_job_template_id",
                schema: "public",
                table: "job",
                column: "template_id");

            migrationBuilder.CreateIndex(
                name: "idx_job_template_active_industry",
                schema: "public",
                table: "job_template",
                columns: new[] { "is_active", "industry" });

            migrationBuilder.CreateIndex(
                name: "uq_job_template_code",
                schema: "public",
                table: "job_template",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_job_template_requirement_order",
                schema: "public",
                table: "job_template_requirement",
                columns: new[] { "template_id", "display_order" });

            migrationBuilder.AddForeignKey(
                name: "job_template_id_fkey",
                schema: "public",
                table: "job",
                column: "template_id",
                principalSchema: "public",
                principalTable: "job_template",
                principalColumn: "template_id",
                onDelete: ReferentialAction.SetNull);

            // MF-01: Internal HR and Platform Admin manage the JD template library.
            migrationBuilder.Sql("""
                INSERT INTO public.permission (code, resource, action, description, is_active, created_at, updated_at)
                VALUES ('job_template.manage', 'job_template', 'manage', 'Manage the shared JD template library', true, now(), now())
                ON CONFLICT (code) DO UPDATE
                SET resource = EXCLUDED.resource,
                    action = EXCLUDED.action,
                    description = EXCLUDED.description,
                    is_active = true,
                    updated_at = now();

                INSERT INTO public.role_permission (role_id, permission_id)
                SELECT r.role_id, p.permission_id
                FROM public.role r
                JOIN public.permission p ON p.code = 'job_template.manage'
                WHERE r.code IN ('INTERNAL_HR', 'PLATFORM_ADMIN')
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
                  AND p.code = 'job_template.manage';

                DELETE FROM public.permission
                WHERE code = 'job_template.manage';
                """);

            migrationBuilder.DropForeignKey(
                name: "job_template_id_fkey",
                schema: "public",
                table: "job");

            migrationBuilder.DropTable(
                name: "job_template_requirement",
                schema: "public");

            migrationBuilder.DropTable(
                name: "job_template",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "idx_job_template_id",
                schema: "public",
                table: "job");

            migrationBuilder.DropColumn(
                name: "template_id",
                schema: "public",
                table: "job");
        }
    }
}
