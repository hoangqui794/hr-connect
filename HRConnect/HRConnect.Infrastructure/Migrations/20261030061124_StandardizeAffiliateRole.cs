using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StandardizeAffiliateRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE public.role
                SET code = 'AFFILIATE',
                    name = 'Affiliate',
                    description = 'Cộng tác viên giới thiệu ứng viên',
                    updated_at = now()
                WHERE code = 'AFFILIATE_RECRUITER';

                UPDATE public.affiliate_application
                SET affiliate_type = 'STANDARD'
                WHERE affiliate_type IN ('RECRUITER', 'INDIVIDUAL');

                UPDATE public.affiliate_profile
                SET affiliate_type = 'STANDARD',
                    updated_at = now()
                WHERE affiliate_type IN ('RECRUITER', 'INDIVIDUAL');
                """);

            migrationBuilder.AlterTable(
                name: "affiliate_application",
                schema: "public",
                comment: "Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE role in the same transaction.",
                oldComment: "Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE_RECRUITER role in the same transaction.");

            migrationBuilder.AlterColumn<decimal>(
                name: "min_experience_years",
                schema: "public",
                table: "job_template",
                type: "numeric(4,1)",
                precision: 4,
                scale: 1,
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "max_experience_years",
                schema: "public",
                table: "job_template",
                type: "numeric(4,1)",
                precision: 4,
                scale: 1,
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "min_experience_years",
                schema: "public",
                table: "job",
                type: "numeric(4,1)",
                precision: 4,
                scale: 1,
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "max_experience_years",
                schema: "public",
                table: "job",
                type: "numeric(4,1)",
                precision: 4,
                scale: 1,
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "affiliate_type",
                schema: "public",
                table: "affiliate_profile",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValueSql: "'STANDARD'::character varying",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValueSql: "'RECRUITER'::character varying");

            migrationBuilder.AlterColumn<string>(
                name: "affiliate_type",
                schema: "public",
                table: "affiliate_application",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValueSql: "'STANDARD'::character varying",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValueSql: "'RECRUITER'::character varying");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE public.role
                SET code = 'AFFILIATE_RECRUITER',
                    name = 'Affiliate Recruiter',
                    description = 'Đối tác tuyển dụng / Cộng tác viên',
                    updated_at = now()
                WHERE code = 'AFFILIATE';

                UPDATE public.affiliate_application
                SET affiliate_type = 'RECRUITER'
                WHERE affiliate_type = 'STANDARD';

                UPDATE public.affiliate_profile
                SET affiliate_type = 'RECRUITER',
                    updated_at = now()
                WHERE affiliate_type = 'STANDARD';
                """);

            migrationBuilder.AlterTable(
                name: "affiliate_application",
                schema: "public",
                comment: "Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE_RECRUITER role in the same transaction.",
                oldComment: "Existing Candidate can apply to become Affiliate without creating a second app_user. Approval should add/re-activate AFFILIATE role in the same transaction.");

            migrationBuilder.AlterColumn<int>(
                name: "min_experience_years",
                schema: "public",
                table: "job_template",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)",
                oldPrecision: 4,
                oldScale: 1,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "max_experience_years",
                schema: "public",
                table: "job_template",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)",
                oldPrecision: 4,
                oldScale: 1,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "min_experience_years",
                schema: "public",
                table: "job",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)",
                oldPrecision: 4,
                oldScale: 1,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "max_experience_years",
                schema: "public",
                table: "job",
                type: "integer",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(4,1)",
                oldPrecision: 4,
                oldScale: 1,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "affiliate_type",
                schema: "public",
                table: "affiliate_profile",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValueSql: "'RECRUITER'::character varying",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValueSql: "'STANDARD'::character varying");

            migrationBuilder.AlterColumn<string>(
                name: "affiliate_type",
                schema: "public",
                table: "affiliate_application",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValueSql: "'RECRUITER'::character varying",
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValueSql: "'STANDARD'::character varying");
        }
    }
}
