using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignMf04DataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.RenameTable(
                name: "warranty",
                schema: "hr_connect",
                newName: "warranty",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "user_token",
                schema: "hr_connect",
                newName: "user_token",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "user_role",
                schema: "hr_connect",
                newName: "user_role",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "submission",
                schema: "hr_connect",
                newName: "submission",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "skill",
                schema: "hr_connect",
                newName: "skill",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "service_type",
                schema: "hr_connect",
                newName: "service_type",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "role_permission",
                schema: "hr_connect",
                newName: "role_permission",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "role",
                schema: "hr_connect",
                newName: "role",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "refresh_token",
                schema: "hr_connect",
                newName: "refresh_token",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "probation",
                schema: "hr_connect",
                newName: "probation",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "placement",
                schema: "hr_connect",
                newName: "placement",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "permission",
                schema: "hr_connect",
                newName: "permission",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "payout",
                schema: "hr_connect",
                newName: "payout",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "offer_approval",
                schema: "hr_connect",
                newName: "offer_approval",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "offer",
                schema: "hr_connect",
                newName: "offer",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "notification",
                schema: "hr_connect",
                newName: "notification",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "match_tier_config",
                schema: "hr_connect",
                newName: "match_tier_config",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "job_status_history",
                schema: "hr_connect",
                newName: "job_status_history",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "job_skill",
                schema: "hr_connect",
                newName: "job_skill",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "job_requirement",
                schema: "hr_connect",
                newName: "job_requirement",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "job",
                schema: "hr_connect",
                newName: "job",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "interview",
                schema: "hr_connect",
                newName: "interview",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "internal_hr_profile",
                schema: "hr_connect",
                newName: "internal_hr_profile",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "email_outbox",
                schema: "hr_connect",
                newName: "email_outbox",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "dispute",
                schema: "hr_connect",
                newName: "dispute",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "cv_template",
                schema: "hr_connect",
                newName: "cv_template",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "company_verification_request",
                schema: "hr_connect",
                newName: "company_verification_request",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "company_user",
                schema: "hr_connect",
                newName: "company_user",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "company",
                schema: "hr_connect",
                newName: "company",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "commission_rule",
                schema: "hr_connect",
                newName: "commission_rule",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "commission_milestone",
                schema: "hr_connect",
                newName: "commission_milestone",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "commission_adjustment",
                schema: "hr_connect",
                newName: "commission_adjustment",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "commission",
                schema: "hr_connect",
                newName: "commission",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "candidate_skill",
                schema: "hr_connect",
                newName: "candidate_skill",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "candidate_job_match",
                schema: "hr_connect",
                newName: "candidate_job_match",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "candidate_cv",
                schema: "hr_connect",
                newName: "candidate_cv",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "candidate",
                schema: "hr_connect",
                newName: "candidate",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "audit_log",
                schema: "hr_connect",
                newName: "audit_log",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "attribution",
                schema: "hr_connect",
                newName: "attribution",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "application_status_history",
                schema: "hr_connect",
                newName: "application_status_history",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "application",
                schema: "hr_connect",
                newName: "application",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "app_user",
                schema: "hr_connect",
                newName: "app_user",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "ai_match_result",
                schema: "hr_connect",
                newName: "ai_match_result",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "affiliate_profile",
                schema: "hr_connect",
                newName: "affiliate_profile",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "affiliate_performance",
                schema: "hr_connect",
                newName: "affiliate_performance",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "affiliate_application",
                schema: "hr_connect",
                newName: "affiliate_application",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "admin_profile",
                schema: "hr_connect",
                newName: "admin_profile",
                newSchema: "public");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "warranty",
                schema: "public",
                newName: "warranty",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "user_token",
                schema: "public",
                newName: "user_token",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "user_role",
                schema: "public",
                newName: "user_role",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "submission",
                schema: "public",
                newName: "submission",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "skill",
                schema: "public",
                newName: "skill",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "service_type",
                schema: "public",
                newName: "service_type",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "role_permission",
                schema: "public",
                newName: "role_permission",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "role",
                schema: "public",
                newName: "role",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "refresh_token",
                schema: "public",
                newName: "refresh_token",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "probation",
                schema: "public",
                newName: "probation",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "placement",
                schema: "public",
                newName: "placement",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "permission",
                schema: "public",
                newName: "permission",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "payout",
                schema: "public",
                newName: "payout",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "offer_approval",
                schema: "public",
                newName: "offer_approval",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "offer",
                schema: "public",
                newName: "offer",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "notification",
                schema: "public",
                newName: "notification",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "match_tier_config",
                schema: "public",
                newName: "match_tier_config",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "job_status_history",
                schema: "public",
                newName: "job_status_history",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "job_skill",
                schema: "public",
                newName: "job_skill",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "job_requirement",
                schema: "public",
                newName: "job_requirement",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "job",
                schema: "public",
                newName: "job",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "interview",
                schema: "public",
                newName: "interview",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "internal_hr_profile",
                schema: "public",
                newName: "internal_hr_profile",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "email_outbox",
                schema: "public",
                newName: "email_outbox",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "dispute",
                schema: "public",
                newName: "dispute",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "cv_template",
                schema: "public",
                newName: "cv_template",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "company_verification_request",
                schema: "public",
                newName: "company_verification_request",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "company_user",
                schema: "public",
                newName: "company_user",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "company",
                schema: "public",
                newName: "company",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "commission_rule",
                schema: "public",
                newName: "commission_rule",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "commission_milestone",
                schema: "public",
                newName: "commission_milestone",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "commission_adjustment",
                schema: "public",
                newName: "commission_adjustment",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "commission",
                schema: "public",
                newName: "commission",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "candidate_skill",
                schema: "public",
                newName: "candidate_skill",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "candidate_job_match",
                schema: "public",
                newName: "candidate_job_match",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "candidate_cv",
                schema: "public",
                newName: "candidate_cv",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "candidate",
                schema: "public",
                newName: "candidate",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "audit_log",
                schema: "public",
                newName: "audit_log",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "attribution",
                schema: "public",
                newName: "attribution",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "application_status_history",
                schema: "public",
                newName: "application_status_history",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "application",
                schema: "public",
                newName: "application",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "app_user",
                schema: "public",
                newName: "app_user",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "ai_match_result",
                schema: "public",
                newName: "ai_match_result",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "affiliate_profile",
                schema: "public",
                newName: "affiliate_profile",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "affiliate_performance",
                schema: "public",
                newName: "affiliate_performance",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "affiliate_application",
                schema: "public",
                newName: "affiliate_application",
                newSchema: "hr_connect");

            migrationBuilder.RenameTable(
                name: "admin_profile",
                schema: "public",
                newName: "admin_profile",
                newSchema: "hr_connect");
        }
    }
}
