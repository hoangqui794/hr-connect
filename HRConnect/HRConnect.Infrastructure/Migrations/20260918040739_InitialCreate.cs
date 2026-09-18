using System;
using System.Net;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "hr_connect");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pgcrypto", ",,");

            migrationBuilder.CreateTable(
                name: "app_user",
                schema: "hr_connect",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    normalized_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    avatar_url = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    email_verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_login_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("app_user_pkey", x => x.user_id);
                },
                comment: "One login identity. A user may simultaneously hold multiple roles through user_role. Candidate + Affiliate is supported on the same account.");

            migrationBuilder.CreateTable(
                name: "commission_milestone",
                schema: "hr_connect",
                columns: table => new
                {
                    milestone_code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("commission_milestone_pkey", x => x.milestone_code);
                });

            migrationBuilder.CreateTable(
                name: "company",
                schema: "hr_connect",
                columns: table => new
                {
                    company_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    company_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    tax_code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    industry = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    company_size = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    website = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    address = table.Column<string>(type: "text", nullable: true),
                    description = table.Column<string>(type: "text", nullable: true),
                    verification_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("company_pkey", x => x.company_id);
                });

            migrationBuilder.CreateTable(
                name: "cv_template",
                schema: "hr_connect",
                columns: table => new
                {
                    cv_template_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    preview_url = table.Column<string>(type: "text", nullable: true),
                    template_config = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("cv_template_pkey", x => x.cv_template_id);
                });

            migrationBuilder.CreateTable(
                name: "match_tier_config",
                schema: "hr_connect",
                columns: table => new
                {
                    tier_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    display_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    min_score = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    max_score = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    color_code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    display_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("match_tier_config_pkey", x => x.tier_code);
                });

            migrationBuilder.CreateTable(
                name: "permission",
                schema: "hr_connect",
                columns: table => new
                {
                    permission_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    code = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    resource = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    action = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("permission_pkey", x => x.permission_id);
                });

            migrationBuilder.CreateTable(
                name: "role",
                schema: "hr_connect",
                columns: table => new
                {
                    role_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_system = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("role_pkey", x => x.role_id);
                });

            migrationBuilder.CreateTable(
                name: "service_type",
                schema: "hr_connect",
                columns: table => new
                {
                    service_type_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("service_type_pkey", x => x.service_type_id);
                });

            migrationBuilder.CreateTable(
                name: "skill",
                schema: "hr_connect",
                columns: table => new
                {
                    skill_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    skill_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    normalized_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    category = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("skill_pkey", x => x.skill_id);
                });

            migrationBuilder.CreateTable(
                name: "admin_profile",
                schema: "hr_connect",
                columns: table => new
                {
                    admin_profile_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    employee_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    job_title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("admin_profile_pkey", x => x.admin_profile_id);
                    table.ForeignKey(
                        name: "admin_profile_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "affiliate_application",
                schema: "hr_connect",
                columns: table => new
                {
                    affiliate_application_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    affiliate_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValueSql: "'RECRUITER'::character varying"),
                    display_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    tax_information = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    contact_person = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    address = table.Column<string>(type: "text", nullable: true),
                    submitted_data = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    review_note = table.Column<string>(type: "text", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("affiliate_application_pkey", x => x.affiliate_application_id);
                    table.ForeignKey(
                        name: "affiliate_application_reviewed_by_fkey",
                        column: x => x.reviewed_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "affiliate_application_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE_RECRUITER role in the same transaction.");

            migrationBuilder.CreateTable(
                name: "affiliate_profile",
                schema: "hr_connect",
                columns: table => new
                {
                    affiliate_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    affiliate_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValueSql: "'RECRUITER'::character varying"),
                    display_name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    tax_information = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    contact_person = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    address = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    verified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("affiliate_profile_pkey", x => x.affiliate_id);
                    table.ForeignKey(
                        name: "affiliate_profile_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "hr_connect",
                columns: table => new
                {
                    audit_log_id = table.Column<long>(type: "bigint", nullable: false, defaultValueSql: "nextval('audit_log_audit_log_id_seq'::regclass)"),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    action = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    old_values = table.Column<string>(type: "jsonb", nullable: true),
                    new_values = table.Column<string>(type: "jsonb", nullable: true),
                    correlation_id = table.Column<Guid>(type: "uuid", nullable: true),
                    ip_address = table.Column<IPAddress>(type: "inet", nullable: true),
                    user_agent = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("audit_log_pkey", x => x.audit_log_id);
                    table.ForeignKey(
                        name: "audit_log_actor_user_id_fkey",
                        column: x => x.actor_user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                },
                comment: "Append-only audit trail. Set hr_connect.current_user_id in the application transaction when actor identity is available.");

            migrationBuilder.CreateTable(
                name: "candidate",
                schema: "hr_connect",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    full_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    normalized_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    normalized_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: true),
                    gender = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    current_address = table.Column<string>(type: "text", nullable: true),
                    highest_education = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    years_of_experience = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    summary = table.Column<string>(type: "text", nullable: true),
                    profile_visibility = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PRIVATE'::character varying"),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    merged_into_candidate_id = table.Column<Guid>(type: "uuid", nullable: true, comment: "Canonical ACTIVE Candidate that owns the merged identity. Merge cycles and non-ACTIVE targets are rejected.")
                },
                constraints: table =>
                {
                    table.PrimaryKey("candidate_pkey", x => x.candidate_id);
                    table.ForeignKey(
                        name: "candidate_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_candidate_merged_into",
                        column: x => x.merged_into_candidate_id,
                        principalSchema: "hr_connect",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "email_outbox",
                schema: "hr_connect",
                columns: table => new
                {
                    email_outbox_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    recipient_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    template_code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    subject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    payload = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    retry_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    next_retry_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("email_outbox_pkey", x => x.email_outbox_id);
                    table.ForeignKey(
                        name: "email_outbox_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "internal_hr_profile",
                schema: "hr_connect",
                columns: table => new
                {
                    hr_profile_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    employee_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    department = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    job_title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("internal_hr_profile_pkey", x => x.hr_profile_id);
                    table.ForeignKey(
                        name: "internal_hr_profile_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "notification",
                schema: "hr_connect",
                columns: table => new
                {
                    notification_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    notification_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, comment: "JOB_FIT is optional D16; other values cover baseline account/company/job/submission/recruitment/commission events."),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    related_entity_type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    related_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    metadata = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    is_read = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    read_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("notification_pkey", x => x.notification_id);
                    table.ForeignKey(
                        name: "notification_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                },
                comment: "In-app notification store. JOB_FIT notifications may reference a Job through related_entity_type/related_entity_id.");

            migrationBuilder.CreateTable(
                name: "refresh_token",
                schema: "hr_connect",
                columns: table => new
                {
                    refresh_token_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    replaced_by_token_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_ip = table.Column<IPAddress>(type: "inet", nullable: true),
                    revoked_by_ip = table.Column<IPAddress>(type: "inet", nullable: true),
                    revoke_reason = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("refresh_token_pkey", x => x.refresh_token_id);
                    table.ForeignKey(
                        name: "refresh_token_replaced_by_token_id_fkey",
                        column: x => x.replaced_by_token_id,
                        principalSchema: "hr_connect",
                        principalTable: "refresh_token",
                        principalColumn: "refresh_token_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "refresh_token_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_token",
                schema: "hr_connect",
                columns: table => new
                {
                    token_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    token_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    created_by_ip = table.Column<IPAddress>(type: "inet", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("user_token_pkey", x => x.token_id);
                    table.ForeignKey(
                        name: "user_token_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "company_user",
                schema: "hr_connect",
                columns: table => new
                {
                    company_user_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_in_company = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    is_primary_contact = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("company_user_pkey", x => x.company_user_id);
                    table.ForeignKey(
                        name: "company_user_company_id_fkey",
                        column: x => x.company_id,
                        principalSchema: "hr_connect",
                        principalTable: "company",
                        principalColumn: "company_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "company_user_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "company_verification_request",
                schema: "hr_connect",
                columns: table => new
                {
                    company_verification_request_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    submitted_by = table.Column<Guid>(type: "uuid", nullable: false),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    submitted_payload = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    review_note = table.Column<string>(type: "text", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("company_verification_request_pkey", x => x.company_verification_request_id);
                    table.ForeignKey(
                        name: "company_verification_request_company_id_fkey",
                        column: x => x.company_id,
                        principalSchema: "hr_connect",
                        principalTable: "company",
                        principalColumn: "company_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "company_verification_request_reviewed_by_fkey",
                        column: x => x.reviewed_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "company_verification_request_submitted_by_fkey",
                        column: x => x.submitted_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "role_permission",
                schema: "hr_connect",
                columns: table => new
                {
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    permission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    granted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("role_permission_pkey", x => new { x.role_id, x.permission_id });
                    table.ForeignKey(
                        name: "role_permission_permission_id_fkey",
                        column: x => x.permission_id,
                        principalSchema: "hr_connect",
                        principalTable: "permission",
                        principalColumn: "permission_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "role_permission_role_id_fkey",
                        column: x => x.role_id,
                        principalSchema: "hr_connect",
                        principalTable: "role",
                        principalColumn: "role_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_role",
                schema: "hr_connect",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_by = table.Column<Guid>(type: "uuid", nullable: true),
                    assignment_source = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false, defaultValueSql: "'SYSTEM'::character varying"),
                    assigned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_by = table.Column<Guid>(type: "uuid", nullable: true),
                    revoke_reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("user_role_pkey", x => new { x.user_id, x.role_id });
                    table.ForeignKey(
                        name: "fk_user_role_revoked_by",
                        column: x => x.revoked_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "user_role_assigned_by_fkey",
                        column: x => x.assigned_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "user_role_role_id_fkey",
                        column: x => x.role_id,
                        principalSchema: "hr_connect",
                        principalTable: "role",
                        principalColumn: "role_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "user_role_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                },
                comment: "Role ownership/lifecycle. Candidate and Affiliate may coexist on the same app_user. Other multi-role combinations remain subject to business policy.");

            migrationBuilder.CreateTable(
                name: "commission_rule",
                schema: "hr_connect",
                columns: table => new
                {
                    commission_rule_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    service_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    milestone_type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    rate_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    rate_value = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    warranty_required = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    effective_from = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    effective_to = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("commission_rule_pkey", x => x.commission_rule_id);
                    table.ForeignKey(
                        name: "commission_rule_service_type_id_fkey",
                        column: x => x.service_type_id,
                        principalSchema: "hr_connect",
                        principalTable: "service_type",
                        principalColumn: "service_type_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_commission_rule_milestone",
                        column: x => x.milestone_type,
                        principalSchema: "hr_connect",
                        principalTable: "commission_milestone",
                        principalColumn: "milestone_code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "job",
                schema: "hr_connect",
                columns: table => new
                {
                    job_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    service_type_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "text", nullable: true),
                    location = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    employment_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    salary_min = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    salary_max = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false, defaultValueSql: "'VND'::bpchar"),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'DRAFT'::character varying", comment: "Allowed Job states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined."),
                    posted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    closed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    visibility = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PUBLIC'::character varying", comment: "D07-ready job visibility. Exact actor permissions remain a business-rule/authorization concern."),
                    status_reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("job_pkey", x => x.job_id);
                    table.ForeignKey(
                        name: "job_company_id_fkey",
                        column: x => x.company_id,
                        principalSchema: "hr_connect",
                        principalTable: "company",
                        principalColumn: "company_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "job_created_by_fkey",
                        column: x => x.created_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "job_service_type_id_fkey",
                        column: x => x.service_type_id,
                        principalSchema: "hr_connect",
                        principalTable: "service_type",
                        principalColumn: "service_type_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "affiliate_performance",
                schema: "hr_connect",
                columns: table => new
                {
                    affiliate_performance_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    affiliate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    period_start = table.Column<DateOnly>(type: "date", nullable: false),
                    period_end = table.Column<DateOnly>(type: "date", nullable: false),
                    total_submissions = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    total_shortlisted = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    total_interviews = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    total_placements = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    submission_to_hire_rate = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: true),
                    quality_rating = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: true),
                    rating_label = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    calculation_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    calculated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("affiliate_performance_pkey", x => x.affiliate_performance_id);
                    table.ForeignKey(
                        name: "affiliate_performance_affiliate_id_fkey",
                        column: x => x.affiliate_id,
                        principalSchema: "hr_connect",
                        principalTable: "affiliate_profile",
                        principalColumn: "affiliate_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "D17-ready performance snapshot. submission_to_hire_rate is supported; quality_rating stays nullable until the rating formula is approved.");

            migrationBuilder.CreateTable(
                name: "candidate_cv",
                schema: "hr_connect",
                columns: table => new
                {
                    cv_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: false),
                    creation_method = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    cv_template_id = table.Column<Guid>(type: "uuid", nullable: true),
                    structured_content = table.Column<string>(type: "jsonb", nullable: true),
                    parsed_data = table.Column<string>(type: "jsonb", nullable: true),
                    source_file_url = table.Column<string>(type: "text", nullable: true),
                    rendered_file_url = table.Column<string>(type: "text", nullable: true),
                    file_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    mime_type = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    file_size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    is_primary = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("candidate_cv_pkey", x => x.cv_id);
                    table.UniqueConstraint("AK_candidate_cv_candidate_id_cv_id", x => new { x.candidate_id, x.cv_id });
                    table.ForeignKey(
                        name: "candidate_cv_candidate_id_fkey",
                        column: x => x.candidate_id,
                        principalSchema: "hr_connect",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "candidate_cv_cv_template_id_fkey",
                        column: x => x.cv_template_id,
                        principalSchema: "hr_connect",
                        principalTable: "cv_template",
                        principalColumn: "cv_template_id",
                        onDelete: ReferentialAction.SetNull);
                },
                comment: "Supports PLATFORM_BUILDER, TEMPLATE_FORM and FILE_UPLOAD CV creation methods.");

            migrationBuilder.CreateTable(
                name: "candidate_skill",
                schema: "hr_connect",
                columns: table => new
                {
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    skill_id = table.Column<Guid>(type: "uuid", nullable: false),
                    proficiency_level = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    years_of_experience = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("candidate_skill_pkey", x => new { x.candidate_id, x.skill_id });
                    table.ForeignKey(
                        name: "candidate_skill_candidate_id_fkey",
                        column: x => x.candidate_id,
                        principalSchema: "hr_connect",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "candidate_skill_skill_id_fkey",
                        column: x => x.skill_id,
                        principalSchema: "hr_connect",
                        principalTable: "skill",
                        principalColumn: "skill_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "job_requirement",
                schema: "hr_connect",
                columns: table => new
                {
                    requirement_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    requirement_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    category = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    content = table.Column<string>(type: "text", nullable: false),
                    weight = table.Column<decimal>(type: "numeric(8,4)", precision: 8, scale: 4, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("job_requirement_pkey", x => x.requirement_id);
                    table.ForeignKey(
                        name: "job_requirement_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "hr_connect",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "job_skill",
                schema: "hr_connect",
                columns: table => new
                {
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    skill_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_mandatory = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    weight = table.Column<decimal>(type: "numeric(8,4)", precision: 8, scale: 4, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("job_skill_pkey", x => new { x.job_id, x.skill_id });
                    table.ForeignKey(
                        name: "job_skill_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "hr_connect",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "job_skill_skill_id_fkey",
                        column: x => x.skill_id,
                        principalSchema: "hr_connect",
                        principalTable: "skill",
                        principalColumn: "skill_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "job_status_history",
                schema: "hr_connect",
                columns: table => new
                {
                    job_status_history_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    old_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    new_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    changed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "text", nullable: true),
                    changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("job_status_history_pkey", x => x.job_status_history_id);
                    table.ForeignKey(
                        name: "job_status_history_changed_by_fkey",
                        column: x => x.changed_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "job_status_history_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "hr_connect",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "candidate_job_match",
                schema: "hr_connect",
                columns: table => new
                {
                    candidate_job_match_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cv_id = table.Column<Guid>(type: "uuid", nullable: true),
                    attempt_no = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    match_score = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    match_tier = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    match_summary = table.Column<string>(type: "jsonb", nullable: true),
                    matching_reasons = table.Column<string>(type: "jsonb", nullable: true),
                    missing_requirements = table.Column<string>(type: "jsonb", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'GENERATED'::character varying"),
                    generated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("candidate_job_match_pkey", x => x.candidate_job_match_id);
                    table.ForeignKey(
                        name: "candidate_job_match_candidate_id_fkey",
                        column: x => x.candidate_id,
                        principalSchema: "hr_connect",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "candidate_job_match_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "hr_connect",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_candidate_job_match_cv_owner",
                        columns: x => new { x.candidate_id, x.cv_id },
                        principalSchema: "hr_connect",
                        principalTable: "candidate_cv",
                        principalColumns: new[] { "candidate_id", "cv_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_candidate_job_match_tier",
                        column: x => x.match_tier,
                        principalSchema: "hr_connect",
                        principalTable: "match_tier_config",
                        principalColumn: "tier_code",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "OPTIONAL D16 capability. Keep disabled/out of baseline if pre-application job-fit recommendation is not approved.");

            migrationBuilder.CreateTable(
                name: "submission",
                schema: "hr_connect",
                columns: table => new
                {
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cv_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    submitted_by = table.Column<Guid>(type: "uuid", nullable: false),
                    source = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false, defaultValueSql: "'RECEIVED'::character varying"),
                    duplicate_of_submission_id = table.Column<Guid>(type: "uuid", nullable: true),
                    note = table.Column<string>(type: "text", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("submission_pkey", x => x.submission_id);
                    table.UniqueConstraint("AK_submission_submission_id_candidate_id_job_id", x => new { x.submission_id, x.candidate_id, x.job_id });
                    table.ForeignKey(
                        name: "fk_submission_cv_owner",
                        columns: x => new { x.candidate_id, x.cv_id },
                        principalSchema: "hr_connect",
                        principalTable: "candidate_cv",
                        principalColumns: new[] { "candidate_id", "cv_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "submission_candidate_id_fkey",
                        column: x => x.candidate_id,
                        principalSchema: "hr_connect",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "submission_duplicate_of_submission_id_fkey",
                        column: x => x.duplicate_of_submission_id,
                        principalSchema: "hr_connect",
                        principalTable: "submission",
                        principalColumn: "submission_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "submission_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "hr_connect",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "submission_submitted_by_fkey",
                        column: x => x.submitted_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Submission intake/audit record. A Submission referenced by Application/Attribution as the accepted winner cannot be invalidated or have its accepted identity/source snapshot changed.");

            migrationBuilder.CreateTable(
                name: "application",
                schema: "hr_connect",
                columns: table => new
                {
                    application_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    candidate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    accepted_submission_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false, defaultValueSql: "'SUBMITTED'::character varying", comment: "Allowed Application states. Exact transition graph is enforced by application service until Business Rule state machine is formally baselined."),
                    current_stage = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    applied_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    status_reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("application_pkey", x => x.application_id);
                    table.ForeignKey(
                        name: "application_candidate_id_fkey",
                        column: x => x.candidate_id,
                        principalSchema: "hr_connect",
                        principalTable: "candidate",
                        principalColumn: "candidate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "application_job_id_fkey",
                        column: x => x.job_id,
                        principalSchema: "hr_connect",
                        principalTable: "job",
                        principalColumn: "job_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_application_accepted_submission",
                        columns: x => new { x.accepted_submission_id, x.candidate_id, x.job_id },
                        principalSchema: "hr_connect",
                        principalTable: "submission",
                        principalColumns: new[] { "submission_id", "candidate_id", "job_id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ai_match_result",
                schema: "hr_connect",
                columns: table => new
                {
                    match_result_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    attempt_no = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    match_score = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: true),
                    match_tier = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true, comment: "Semantic tier (for example HIGH/MEDIUM_HIGH/MEDIUM/LOW). UI color comes from match_tier_config; AI does not make the final hiring decision."),
                    candidate_highlight = table.Column<string>(type: "jsonb", nullable: true),
                    must_have_result = table.Column<string>(type: "jsonb", nullable: true),
                    should_have_result = table.Column<string>(type: "jsonb", nullable: true),
                    raw_response = table.Column<string>(type: "jsonb", nullable: true),
                    external_reference = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    error_message = table.Column<string>(type: "text", nullable: true),
                    requested_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("ai_match_result_pkey", x => x.match_result_id);
                    table.ForeignKey(
                        name: "ai_match_result_application_id_fkey",
                        column: x => x.application_id,
                        principalSchema: "hr_connect",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_ai_match_result_tier",
                        column: x => x.match_tier,
                        principalSchema: "hr_connect",
                        principalTable: "match_tier_config",
                        principalColumn: "tier_code",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Post-application AI screening support. Match Score/Tier/Highlight support human review; AI does not auto-reject/shortlist/hire.");

            migrationBuilder.CreateTable(
                name: "application_status_history",
                schema: "hr_connect",
                columns: table => new
                {
                    application_status_history_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    old_status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    new_status = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    changed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "text", nullable: true),
                    changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("application_status_history_pkey", x => x.application_status_history_id);
                    table.ForeignKey(
                        name: "application_status_history_application_id_fkey",
                        column: x => x.application_id,
                        principalSchema: "hr_connect",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "application_status_history_changed_by_fkey",
                        column: x => x.changed_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "attribution",
                schema: "hr_connect",
                columns: table => new
                {
                    attribution_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    affiliate_id = table.Column<Guid>(type: "uuid", nullable: false),
                    winning_submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    attribution_rule = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false, defaultValueSql: "'FIRST_SUBMISSION_TIMESTAMP_PRECEDENCE'::character varying"),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'ACTIVE'::character varying"),
                    established_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("attribution_pkey", x => x.attribution_id);
                    table.ForeignKey(
                        name: "attribution_affiliate_id_fkey",
                        column: x => x.affiliate_id,
                        principalSchema: "hr_connect",
                        principalTable: "affiliate_profile",
                        principalColumn: "affiliate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "attribution_application_id_fkey",
                        column: x => x.application_id,
                        principalSchema: "hr_connect",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "attribution_winning_submission_id_fkey",
                        column: x => x.winning_submission_id,
                        principalSchema: "hr_connect",
                        principalTable: "submission",
                        principalColumn: "submission_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "First accepted Affiliate Submission attribution. Trigger validates source/status/Candidate/Job and blocks self-attribution by account/email/phone.");

            migrationBuilder.CreateTable(
                name: "interview",
                schema: "hr_connect",
                columns: table => new
                {
                    interview_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    interview_round = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    interview_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    scheduled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    duration_minutes = table.Column<int>(type: "integer", nullable: true),
                    location = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    meeting_link = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'SCHEDULED'::character varying"),
                    result = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    feedback = table.Column<string>(type: "text", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("interview_pkey", x => x.interview_id);
                    table.ForeignKey(
                        name: "interview_application_id_fkey",
                        column: x => x.application_id,
                        principalSchema: "hr_connect",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "interview_created_by_fkey",
                        column: x => x.created_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "offer",
                schema: "hr_connect",
                columns: table => new
                {
                    offer_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_version = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    salary = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    currency_code = table.Column<string>(type: "character(3)", fixedLength: true, maxLength: 3, nullable: false, defaultValueSql: "'VND'::bpchar"),
                    start_date = table.Column<DateOnly>(type: "date", nullable: true),
                    expiry_date = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("offer_pkey", x => x.offer_id);
                    table.UniqueConstraint("AK_offer_offer_id_application_id", x => new { x.offer_id, x.application_id });
                    table.ForeignKey(
                        name: "offer_application_id_fkey",
                        column: x => x.application_id,
                        principalSchema: "hr_connect",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "offer_created_by_fkey",
                        column: x => x.created_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "offer_approval",
                schema: "hr_connect",
                columns: table => new
                {
                    approval_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    offer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    approval_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    comment = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("offer_approval_pkey", x => x.approval_id);
                    table.ForeignKey(
                        name: "offer_approval_offer_id_fkey",
                        column: x => x.offer_id,
                        principalSchema: "hr_connect",
                        principalTable: "offer",
                        principalColumn: "offer_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "offer_approval_user_id_fkey",
                        column: x => x.user_id,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "PROPOSED. Remove if the team does not implement a separate offer approval workflow.");

            migrationBuilder.CreateTable(
                name: "placement",
                schema: "hr_connect",
                columns: table => new
                {
                    placement_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    application_id = table.Column<Guid>(type: "uuid", nullable: false),
                    offer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actual_start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    position = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    department = table.Column<string>(type: "character varying(180)", maxLength: 180, nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'STARTED'::character varying"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("placement_pkey", x => x.placement_id);
                    table.ForeignKey(
                        name: "fk_placement_offer_application",
                        columns: x => new { x.offer_id, x.application_id },
                        principalSchema: "hr_connect",
                        principalTable: "offer",
                        principalColumns: new[] { "offer_id", "application_id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "placement_application_id_fkey",
                        column: x => x.application_id,
                        principalSchema: "hr_connect",
                        principalTable: "application",
                        principalColumn: "application_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "commission",
                schema: "hr_connect",
                columns: table => new
                {
                    commission_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    attribution_id = table.Column<Guid>(type: "uuid", nullable: false),
                    placement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    commission_rule_id = table.Column<Guid>(type: "uuid", nullable: false),
                    milestone_type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    base_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying", comment: "Allowed Commission states. PAYABLE means approved for external/manual payment. payout.status=COMPLETED is payment source of truth."),
                    approved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    approved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    rule_snapshot = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    calculation_snapshot = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    calculated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("commission_pkey", x => x.commission_id);
                    table.ForeignKey(
                        name: "commission_approved_by_fkey",
                        column: x => x.approved_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "commission_attribution_id_fkey",
                        column: x => x.attribution_id,
                        principalSchema: "hr_connect",
                        principalTable: "attribution",
                        principalColumn: "attribution_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "commission_commission_rule_id_fkey",
                        column: x => x.commission_rule_id,
                        principalSchema: "hr_connect",
                        principalTable: "commission_rule",
                        principalColumn: "commission_rule_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "commission_placement_id_fkey",
                        column: x => x.placement_id,
                        principalSchema: "hr_connect",
                        principalTable: "placement",
                        principalColumn: "placement_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_commission_milestone",
                        column: x => x.milestone_type,
                        principalSchema: "hr_connect",
                        principalTable: "commission_milestone",
                        principalColumn: "milestone_code",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Commission eligibility/calculation domain. PAYABLE means approved for payment; payment completion is represented by payout.status=COMPLETED.");

            migrationBuilder.CreateTable(
                name: "probation",
                schema: "hr_connect",
                columns: table => new
                {
                    probation_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    placement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    result = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("probation_pkey", x => x.probation_id);
                    table.ForeignKey(
                        name: "probation_placement_id_fkey",
                        column: x => x.placement_id,
                        principalSchema: "hr_connect",
                        principalTable: "placement",
                        principalColumn: "placement_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "probation_updated_by_fkey",
                        column: x => x.updated_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "warranty",
                schema: "hr_connect",
                columns: table => new
                {
                    warranty_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    placement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'IN_PROGRESS'::character varying"),
                    result_note = table.Column<string>(type: "text", nullable: true),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("warranty_pkey", x => x.warranty_id);
                    table.ForeignKey(
                        name: "warranty_placement_id_fkey",
                        column: x => x.placement_id,
                        principalSchema: "hr_connect",
                        principalTable: "placement",
                        principalColumn: "placement_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "warranty_updated_by_fkey",
                        column: x => x.updated_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                },
                comment: "Warranty exists only when applicable. No row may represent NOT_APPLICABLE; absence of a warranty row means not applicable.");

            migrationBuilder.CreateTable(
                name: "commission_adjustment",
                schema: "hr_connect",
                columns: table => new
                {
                    commission_adjustment_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    commission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    old_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    new_amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false),
                    adjusted_by = table.Column<Guid>(type: "uuid", nullable: false),
                    adjusted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("commission_adjustment_pkey", x => x.commission_adjustment_id);
                    table.ForeignKey(
                        name: "commission_adjustment_adjusted_by_fkey",
                        column: x => x.adjusted_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "commission_adjustment_commission_id_fkey",
                        column: x => x.commission_id,
                        principalSchema: "hr_connect",
                        principalTable: "commission",
                        principalColumn: "commission_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "Append-only Commission adjustment event. UPDATE/DELETE are prohibited; corrections require a new adjustment event.");

            migrationBuilder.CreateTable(
                name: "dispute",
                schema: "hr_connect",
                columns: table => new
                {
                    dispute_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    dispute_type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: true),
                    attribution_id = table.Column<Guid>(type: "uuid", nullable: true),
                    commission_id = table.Column<Guid>(type: "uuid", nullable: true),
                    raised_by = table.Column<Guid>(type: "uuid", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false),
                    evidence = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'OPEN'::character varying"),
                    resolved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    resolution = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    resolved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("dispute_pkey", x => x.dispute_id);
                    table.ForeignKey(
                        name: "dispute_attribution_id_fkey",
                        column: x => x.attribution_id,
                        principalSchema: "hr_connect",
                        principalTable: "attribution",
                        principalColumn: "attribution_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "dispute_commission_id_fkey",
                        column: x => x.commission_id,
                        principalSchema: "hr_connect",
                        principalTable: "commission",
                        principalColumn: "commission_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "dispute_raised_by_fkey",
                        column: x => x.raised_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "dispute_resolved_by_fkey",
                        column: x => x.resolved_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "dispute_submission_id_fkey",
                        column: x => x.submission_id,
                        principalSchema: "hr_connect",
                        principalTable: "submission",
                        principalColumn: "submission_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payout",
                schema: "hr_connect",
                columns: table => new
                {
                    payout_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    commission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    payout_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    method = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    transaction_reference = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    evidence_url = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValueSql: "'PENDING'::character varying"),
                    recorded_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    attempt_no = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("payout_pkey", x => x.payout_id);
                    table.ForeignKey(
                        name: "payout_commission_id_fkey",
                        column: x => x.commission_id,
                        principalSchema: "hr_connect",
                        principalTable: "commission",
                        principalColumn: "commission_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "payout_recorded_by_fkey",
                        column: x => x.recorded_by,
                        principalSchema: "hr_connect",
                        principalTable: "app_user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.SetNull);
                },
                comment: "Manual/external payout ledger. Rows are never physically deleted. PENDING may become COMPLETED/FAILED/CANCELLED; terminal rows are immutable.");

            migrationBuilder.CreateIndex(
                name: "admin_profile_employee_code_key",
                schema: "hr_connect",
                table: "admin_profile",
                column: "employee_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "admin_profile_user_id_key",
                schema: "hr_connect",
                table: "admin_profile",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_affiliate_application_reviewed_by",
                schema: "hr_connect",
                table: "affiliate_application",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "uq_affiliate_application_open",
                schema: "hr_connect",
                table: "affiliate_application",
                column: "user_id",
                unique: true,
                filter: "((status)::text = ANY ((ARRAY['PENDING'::character varying, 'UNDER_REVIEW'::character varying])::text[]))");

            migrationBuilder.CreateIndex(
                name: "affiliate_performance_affiliate_id_period_start_period_end_key",
                schema: "hr_connect",
                table: "affiliate_performance",
                columns: new[] { "affiliate_id", "period_start", "period_end" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_affiliate_performance_affiliate_period",
                schema: "hr_connect",
                table: "affiliate_performance",
                columns: new[] { "affiliate_id", "period_end" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "affiliate_profile_user_id_key",
                schema: "hr_connect",
                table: "affiliate_profile",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ai_match_result_application_id_attempt_no_key",
                schema: "hr_connect",
                table: "ai_match_result",
                columns: new[] { "application_id", "attempt_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_ai_match_application",
                schema: "hr_connect",
                table: "ai_match_result",
                columns: new[] { "application_id", "attempt_no" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_ai_match_result_match_tier",
                schema: "hr_connect",
                table: "ai_match_result",
                column: "match_tier");

            migrationBuilder.CreateIndex(
                name: "idx_app_user_normalized_phone",
                schema: "hr_connect",
                table: "app_user",
                column: "normalized_phone",
                filter: "(normalized_phone IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "idx_app_user_status",
                schema: "hr_connect",
                table: "app_user",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "application_candidate_id_job_id_key",
                schema: "hr_connect",
                table: "application",
                columns: new[] { "candidate_id", "job_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_application_candidate",
                schema: "hr_connect",
                table: "application",
                columns: new[] { "candidate_id", "updated_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "idx_application_job_status",
                schema: "hr_connect",
                table: "application",
                columns: new[] { "job_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_application_accepted_submission_id_candidate_id_job_id",
                schema: "hr_connect",
                table: "application",
                columns: new[] { "accepted_submission_id", "candidate_id", "job_id" });

            migrationBuilder.CreateIndex(
                name: "idx_application_status_history_app",
                schema: "hr_connect",
                table: "application_status_history",
                columns: new[] { "application_id", "changed_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_application_status_history_changed_by",
                schema: "hr_connect",
                table: "application_status_history",
                column: "changed_by");

            migrationBuilder.CreateIndex(
                name: "attribution_application_id_key",
                schema: "hr_connect",
                table: "attribution",
                column: "application_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "attribution_winning_submission_id_key",
                schema: "hr_connect",
                table: "attribution",
                column: "winning_submission_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_attribution_affiliate_id",
                schema: "hr_connect",
                table: "attribution",
                column: "affiliate_id");

            migrationBuilder.CreateIndex(
                name: "idx_audit_log_actor",
                schema: "hr_connect",
                table: "audit_log",
                columns: new[] { "actor_user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "idx_audit_log_entity",
                schema: "hr_connect",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id", "created_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "candidate_user_id_key",
                schema: "hr_connect",
                table: "candidate",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_candidate_status",
                schema: "hr_connect",
                table: "candidate",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_merged_into_candidate_id",
                schema: "hr_connect",
                table: "candidate",
                column: "merged_into_candidate_id");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_identity_email",
                schema: "hr_connect",
                table: "candidate",
                column: "normalized_email",
                unique: true,
                filter: "((normalized_email IS NOT NULL) AND ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_identity_phone",
                schema: "hr_connect",
                table: "candidate",
                column: "normalized_phone",
                unique: true,
                filter: "((normalized_phone IS NOT NULL) AND ((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))");

            migrationBuilder.CreateIndex(
                name: "idx_candidate_cv_candidate",
                schema: "hr_connect",
                table: "candidate_cv",
                columns: new[] { "candidate_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "idx_candidate_cv_creation_method",
                schema: "hr_connect",
                table: "candidate_cv",
                columns: new[] { "creation_method", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_candidate_cv_cv_template_id",
                schema: "hr_connect",
                table: "candidate_cv",
                column: "cv_template_id");

            migrationBuilder.CreateIndex(
                name: "uq_candidate_cv_owner",
                schema: "hr_connect",
                table: "candidate_cv",
                columns: new[] { "candidate_id", "cv_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_candidate_primary_cv",
                schema: "hr_connect",
                table: "candidate_cv",
                column: "candidate_id",
                unique: true,
                filter: "((is_primary = true) AND ((status)::text = 'ACTIVE'::text))");

            migrationBuilder.CreateIndex(
                name: "candidate_job_match_candidate_id_job_id_attempt_no_key",
                schema: "hr_connect",
                table: "candidate_job_match",
                columns: new[] { "candidate_id", "job_id", "attempt_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_candidate_job_match_candidate_score",
                schema: "hr_connect",
                table: "candidate_job_match",
                columns: new[] { "candidate_id", "match_score", "generated_at" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "idx_candidate_job_match_job",
                schema: "hr_connect",
                table: "candidate_job_match",
                columns: new[] { "job_id", "generated_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_candidate_job_match_candidate_id_cv_id",
                schema: "hr_connect",
                table: "candidate_job_match",
                columns: new[] { "candidate_id", "cv_id" });

            migrationBuilder.CreateIndex(
                name: "IX_candidate_job_match_match_tier",
                schema: "hr_connect",
                table: "candidate_job_match",
                column: "match_tier");

            migrationBuilder.CreateIndex(
                name: "IX_candidate_skill_skill_id",
                schema: "hr_connect",
                table: "candidate_skill",
                column: "skill_id");

            migrationBuilder.CreateIndex(
                name: "idx_commission_status",
                schema: "hr_connect",
                table: "commission",
                columns: new[] { "status", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_commission_approved_by",
                schema: "hr_connect",
                table: "commission",
                column: "approved_by");

            migrationBuilder.CreateIndex(
                name: "IX_commission_commission_rule_id",
                schema: "hr_connect",
                table: "commission",
                column: "commission_rule_id");

            migrationBuilder.CreateIndex(
                name: "IX_commission_milestone_type",
                schema: "hr_connect",
                table: "commission",
                column: "milestone_type");

            migrationBuilder.CreateIndex(
                name: "IX_commission_placement_id",
                schema: "hr_connect",
                table: "commission",
                column: "placement_id");

            migrationBuilder.CreateIndex(
                name: "uq_commission_attribution_placement",
                schema: "hr_connect",
                table: "commission",
                columns: new[] { "attribution_id", "placement_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_commission_adjustment_commission",
                schema: "hr_connect",
                table: "commission_adjustment",
                columns: new[] { "commission_id", "adjusted_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_commission_adjustment_adjusted_by",
                schema: "hr_connect",
                table: "commission_adjustment",
                column: "adjusted_by");

            migrationBuilder.CreateIndex(
                name: "idx_commission_rule_active",
                schema: "hr_connect",
                table: "commission_rule",
                columns: new[] { "service_type_id", "milestone_type", "effective_from" },
                descending: new[] { false, false, true },
                filter: "(is_active = true)");

            migrationBuilder.CreateIndex(
                name: "IX_commission_rule_milestone_type",
                schema: "hr_connect",
                table: "commission_rule",
                column: "milestone_type");

            migrationBuilder.CreateIndex(
                name: "uq_company_tax_code",
                schema: "hr_connect",
                table: "company",
                column: "tax_code",
                unique: true,
                filter: "(tax_code IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "company_user_company_id_user_id_key",
                schema: "hr_connect",
                table: "company_user",
                columns: new[] { "company_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_company_user_user_id",
                schema: "hr_connect",
                table: "company_user",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "uq_company_primary_contact",
                schema: "hr_connect",
                table: "company_user",
                column: "company_id",
                unique: true,
                filter: "((is_primary_contact = true) AND ((status)::text = 'ACTIVE'::text))");

            migrationBuilder.CreateIndex(
                name: "IX_company_verification_request_reviewed_by",
                schema: "hr_connect",
                table: "company_verification_request",
                column: "reviewed_by");

            migrationBuilder.CreateIndex(
                name: "IX_company_verification_request_submitted_by",
                schema: "hr_connect",
                table: "company_verification_request",
                column: "submitted_by");

            migrationBuilder.CreateIndex(
                name: "uq_company_verification_open",
                schema: "hr_connect",
                table: "company_verification_request",
                column: "company_id",
                unique: true,
                filter: "((status)::text = ANY ((ARRAY['PENDING'::character varying, 'UNDER_REVIEW'::character varying])::text[]))");

            migrationBuilder.CreateIndex(
                name: "cv_template_code_key",
                schema: "hr_connect",
                table: "cv_template",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_dispute_attribution_id",
                schema: "hr_connect",
                table: "dispute",
                column: "attribution_id");

            migrationBuilder.CreateIndex(
                name: "IX_dispute_commission_id",
                schema: "hr_connect",
                table: "dispute",
                column: "commission_id");

            migrationBuilder.CreateIndex(
                name: "IX_dispute_raised_by",
                schema: "hr_connect",
                table: "dispute",
                column: "raised_by");

            migrationBuilder.CreateIndex(
                name: "IX_dispute_resolved_by",
                schema: "hr_connect",
                table: "dispute",
                column: "resolved_by");

            migrationBuilder.CreateIndex(
                name: "IX_dispute_submission_id",
                schema: "hr_connect",
                table: "dispute",
                column: "submission_id");

            migrationBuilder.CreateIndex(
                name: "idx_email_outbox_pending",
                schema: "hr_connect",
                table: "email_outbox",
                columns: new[] { "status", "next_retry_at", "created_at" },
                filter: "((status)::text = ANY ((ARRAY['PENDING'::character varying, 'FAILED'::character varying])::text[]))");

            migrationBuilder.CreateIndex(
                name: "IX_email_outbox_user_id",
                schema: "hr_connect",
                table: "email_outbox",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "internal_hr_profile_employee_code_key",
                schema: "hr_connect",
                table: "internal_hr_profile",
                column: "employee_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "internal_hr_profile_user_id_key",
                schema: "hr_connect",
                table: "internal_hr_profile",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "interview_application_id_interview_round_key",
                schema: "hr_connect",
                table: "interview",
                columns: new[] { "application_id", "interview_round" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_interview_created_by",
                schema: "hr_connect",
                table: "interview",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "idx_job_active",
                schema: "hr_connect",
                table: "job",
                columns: new[] { "company_id", "service_type_id", "posted_at" },
                descending: new[] { false, false, true },
                filter: "((status)::text = 'ACTIVE'::text)");

            migrationBuilder.CreateIndex(
                name: "idx_job_company_status",
                schema: "hr_connect",
                table: "job",
                columns: new[] { "company_id", "status" });

            migrationBuilder.CreateIndex(
                name: "idx_job_service_type_status",
                schema: "hr_connect",
                table: "job",
                columns: new[] { "service_type_id", "status" });

            migrationBuilder.CreateIndex(
                name: "idx_job_visibility_status",
                schema: "hr_connect",
                table: "job",
                columns: new[] { "visibility", "status", "posted_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_job_created_by",
                schema: "hr_connect",
                table: "job",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "IX_job_requirement_job_id",
                schema: "hr_connect",
                table: "job_requirement",
                column: "job_id");

            migrationBuilder.CreateIndex(
                name: "IX_job_skill_skill_id",
                schema: "hr_connect",
                table: "job_skill",
                column: "skill_id");

            migrationBuilder.CreateIndex(
                name: "idx_job_status_history_job",
                schema: "hr_connect",
                table: "job_status_history",
                columns: new[] { "job_id", "changed_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_job_status_history_changed_by",
                schema: "hr_connect",
                table: "job_status_history",
                column: "changed_by");

            migrationBuilder.CreateIndex(
                name: "idx_notification_unread",
                schema: "hr_connect",
                table: "notification",
                columns: new[] { "user_id", "created_at" },
                descending: new[] { false, true },
                filter: "(is_read = false)");

            migrationBuilder.CreateIndex(
                name: "idx_notification_user_created",
                schema: "hr_connect",
                table: "notification",
                columns: new[] { "user_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_offer_created_by",
                schema: "hr_connect",
                table: "offer",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "offer_application_id_offer_version_key",
                schema: "hr_connect",
                table: "offer",
                columns: new[] { "application_id", "offer_version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_offer_application_pair",
                schema: "hr_connect",
                table: "offer",
                columns: new[] { "offer_id", "application_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_offer_approval_user_id",
                schema: "hr_connect",
                table: "offer_approval",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "offer_approval_offer_id_user_id_key",
                schema: "hr_connect",
                table: "offer_approval",
                columns: new[] { "offer_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_payout_commission_status",
                schema: "hr_connect",
                table: "payout",
                columns: new[] { "commission_id", "status", "created_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_payout_recorded_by",
                schema: "hr_connect",
                table: "payout",
                column: "recorded_by");

            migrationBuilder.CreateIndex(
                name: "uq_payout_attempt",
                schema: "hr_connect",
                table: "payout",
                columns: new[] { "commission_id", "attempt_no" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "permission_code_key",
                schema: "hr_connect",
                table: "permission",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_placement_offer_id_application_id",
                schema: "hr_connect",
                table: "placement",
                columns: new[] { "offer_id", "application_id" });

            migrationBuilder.CreateIndex(
                name: "placement_application_id_key",
                schema: "hr_connect",
                table: "placement",
                column: "application_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "placement_offer_id_key",
                schema: "hr_connect",
                table: "placement",
                column: "offer_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_probation_updated_by",
                schema: "hr_connect",
                table: "probation",
                column: "updated_by");

            migrationBuilder.CreateIndex(
                name: "probation_placement_id_key",
                schema: "hr_connect",
                table: "probation",
                column: "placement_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_refresh_token_active",
                schema: "hr_connect",
                table: "refresh_token",
                columns: new[] { "user_id", "expires_at" },
                descending: new[] { false, true },
                filter: "(revoked_at IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_refresh_token_replaced_by_token_id",
                schema: "hr_connect",
                table: "refresh_token",
                column: "replaced_by_token_id");

            migrationBuilder.CreateIndex(
                name: "refresh_token_token_hash_key",
                schema: "hr_connect",
                table: "refresh_token",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "role_code_key",
                schema: "hr_connect",
                table: "role",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_role_permission_permission_id",
                schema: "hr_connect",
                table: "role_permission",
                column: "permission_id");

            migrationBuilder.CreateIndex(
                name: "service_type_code_key",
                schema: "hr_connect",
                table: "service_type",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "skill_normalized_name_key",
                schema: "hr_connect",
                table: "skill",
                column: "normalized_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_submission_job_candidate",
                schema: "hr_connect",
                table: "submission",
                columns: new[] { "job_id", "candidate_id", "submitted_at" });

            migrationBuilder.CreateIndex(
                name: "idx_submission_submitted_by",
                schema: "hr_connect",
                table: "submission",
                columns: new[] { "submitted_by", "submitted_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "IX_submission_candidate_id_cv_id",
                schema: "hr_connect",
                table: "submission",
                columns: new[] { "candidate_id", "cv_id" });

            migrationBuilder.CreateIndex(
                name: "IX_submission_duplicate_of_submission_id",
                schema: "hr_connect",
                table: "submission",
                column: "duplicate_of_submission_id");

            migrationBuilder.CreateIndex(
                name: "uq_submission_identity",
                schema: "hr_connect",
                table: "submission",
                columns: new[] { "submission_id", "candidate_id", "job_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uq_submission_one_accepted",
                schema: "hr_connect",
                table: "submission",
                columns: new[] { "job_id", "candidate_id" },
                unique: true,
                filter: "((status)::text = 'ACCEPTED'::text)");

            migrationBuilder.CreateIndex(
                name: "idx_user_role_active_user",
                schema: "hr_connect",
                table: "user_role",
                columns: new[] { "user_id", "role_id" },
                filter: "((status)::text = 'ACTIVE'::text)");

            migrationBuilder.CreateIndex(
                name: "idx_user_role_role_id",
                schema: "hr_connect",
                table: "user_role",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_role_assigned_by",
                schema: "hr_connect",
                table: "user_role",
                column: "assigned_by");

            migrationBuilder.CreateIndex(
                name: "IX_user_role_revoked_by",
                schema: "hr_connect",
                table: "user_role",
                column: "revoked_by");

            migrationBuilder.CreateIndex(
                name: "idx_user_token_active",
                schema: "hr_connect",
                table: "user_token",
                columns: new[] { "user_id", "token_type", "expires_at" },
                filter: "(used_at IS NULL)");

            migrationBuilder.CreateIndex(
                name: "idx_user_token_lookup",
                schema: "hr_connect",
                table: "user_token",
                columns: new[] { "user_id", "token_type", "expires_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_warranty_updated_by",
                schema: "hr_connect",
                table: "warranty",
                column: "updated_by");

            migrationBuilder.CreateIndex(
                name: "warranty_placement_id_key",
                schema: "hr_connect",
                table: "warranty",
                column: "placement_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "admin_profile",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "affiliate_application",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "affiliate_performance",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "ai_match_result",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "application_status_history",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "candidate_job_match",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "candidate_skill",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "commission_adjustment",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "company_user",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "company_verification_request",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "dispute",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "email_outbox",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "internal_hr_profile",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "interview",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "job_requirement",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "job_skill",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "job_status_history",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "notification",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "offer_approval",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "payout",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "probation",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "refresh_token",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "role_permission",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "user_role",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "user_token",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "warranty",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "match_tier_config",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "skill",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "commission",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "permission",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "role",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "attribution",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "commission_rule",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "placement",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "affiliate_profile",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "commission_milestone",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "offer",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "application",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "submission",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "candidate_cv",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "job",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "candidate",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "cv_template",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "company",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "service_type",
                schema: "hr_connect");

            migrationBuilder.DropTable(
                name: "app_user",
                schema: "hr_connect");
        }
    }
}
