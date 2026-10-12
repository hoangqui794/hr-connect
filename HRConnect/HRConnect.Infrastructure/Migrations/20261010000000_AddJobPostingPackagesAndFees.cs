using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(HRConnect.Infrastructure.Persistence.ApplicationDbContext))]
[Migration("20261010000000_AddJobPostingPackagesAndFees")]
public partial class AddJobPostingPackagesAndFees : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1. Tạo bảng job_posting_package
        migrationBuilder.CreateTable(
            name: "job_posting_package",
            schema: "public",
            columns: table => new
            {
                package_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                description = table.Column<string>(type: "text", nullable: true),
                price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                duration_days = table.Column<int>(type: "integer", nullable: false, defaultValue: 30),
                is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
            },
            constraints: table =>
            {
                table.PrimaryKey("job_posting_package_pkey", x => x.package_id);
            });

        migrationBuilder.CreateIndex(
            name: "idx_job_posting_package_code",
            schema: "public",
            table: "job_posting_package",
            column: "code",
            unique: true);

        // 2. Thêm cột posting_package_id và expires_at vào bảng job
        migrationBuilder.AddColumn<Guid>(
            name: "posting_package_id",
            schema: "public",
            table: "job",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<DateTime>(
            name: "expires_at",
            schema: "public",
            table: "job",
            type: "timestamp with time zone",
            nullable: true);

        migrationBuilder.AddForeignKey(
            name: "job_posting_package_id_fkey",
            schema: "public",
            table: "job",
            column: "posting_package_id",
            principalSchema: "public",
            principalTable: "job_posting_package",
            principalColumn: "package_id",
            onDelete: ReferentialAction.SetNull);

        // 3. Tạo bảng job_posting_fee
        migrationBuilder.CreateTable(
            name: "job_posting_fee",
            schema: "public",
            columns: table => new
            {
                posting_fee_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                job_id = table.Column<Guid>(type: "uuid", nullable: false),
                package_id = table.Column<Guid>(type: "uuid", nullable: false),
                company_id = table.Column<Guid>(type: "uuid", nullable: false),
                amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                currency_code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false, defaultValue: "VND"),
                status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "PENDING"),
                paid_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                payment_reference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                recorded_by = table.Column<Guid>(type: "uuid", nullable: true),
                activated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
            },
            constraints: table =>
            {
                table.PrimaryKey("job_posting_fee_pkey", x => x.posting_fee_id);
                table.ForeignKey(
                    name: "job_posting_fee_job_id_fkey",
                    column: x => x.job_id,
                    principalSchema: "public",
                    principalTable: "job",
                    principalColumn: "job_id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "job_posting_fee_package_id_fkey",
                    column: x => x.package_id,
                    principalSchema: "public",
                    principalTable: "job_posting_package",
                    principalColumn: "package_id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "job_posting_fee_company_id_fkey",
                    column: x => x.company_id,
                    principalSchema: "public",
                    principalTable: "company",
                    principalColumn: "company_id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "job_posting_fee_recorded_by_fkey",
                    column: x => x.recorded_by,
                    principalSchema: "public",
                    principalTable: "app_user",
                    principalColumn: "user_id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateIndex(
            name: "idx_job_posting_fee_job_id",
            schema: "public",
            table: "job_posting_fee",
            column: "job_id");

        migrationBuilder.CreateIndex(
            name: "idx_job_posting_fee_company_status",
            schema: "public",
            table: "job_posting_fee",
            columns: new[] { "company_id", "status" });

        // 4. Seed 2 gói mặc định FREE và STANDARD
        migrationBuilder.Sql("""
            INSERT INTO public.job_posting_package (package_id, code, name, description, price, duration_days, is_active, created_at, updated_at)
            VALUES
              ('a0000001-0000-0000-0000-000000000001', 'FREE', 'Gói Miễn Phí (Trải nghiệm)', 'Đăng 1 tin tuyển dụng hiển thị 30 ngày, tối đa 1 tin mở đồng thời, chu kỳ 2 tháng.', 0, 30, true, now(), now()),
              ('a0000001-0000-0000-0000-000000000002', 'STANDARD', 'Gói Tiêu Chuẩn 30 Ngày', 'Đăng tin công khai 30 ngày, ứng viên nộp hồ sơ không giới hạn, chấm điểm ứng viên bằng AI.', 1500000, 30, true, now(), now())
            ON CONFLICT (code) DO NOTHING;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "job_posting_fee",
            schema: "public");

        migrationBuilder.DropForeignKey(
            name: "job_posting_package_id_fkey",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "expires_at",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "posting_package_id",
            schema: "public",
            table: "job");

        migrationBuilder.DropTable(
            name: "job_posting_package",
            schema: "public");
    }
}
