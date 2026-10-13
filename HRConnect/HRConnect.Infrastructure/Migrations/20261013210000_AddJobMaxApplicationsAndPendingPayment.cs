using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(HRConnect.Infrastructure.Persistence.ApplicationDbContext))]
[Migration("20261013210000_AddJobMaxApplicationsAndPendingPayment")]
public partial class AddJobMaxApplicationsAndPendingPayment : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "max_applications",
            schema: "public",
            table: "job_posting_package",
            type: "integer",
            nullable: true,
            defaultValue: 50);

        migrationBuilder.AddColumn<int>(
            name: "max_applications",
            schema: "public",
            table: "job",
            type: "integer",
            nullable: true);

        // Đảm bảo các gói hiện có được cập nhật giá trị mặc định 50 hồ sơ
        migrationBuilder.Sql("""
            UPDATE public.job_posting_package
            SET max_applications = 50
            WHERE max_applications IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "max_applications",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "max_applications",
            schema: "public",
            table: "job_posting_package");
    }
}
