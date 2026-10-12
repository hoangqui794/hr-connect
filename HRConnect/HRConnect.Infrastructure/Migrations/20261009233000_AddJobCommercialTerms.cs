using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations;

[DbContext(typeof(HRConnect.Infrastructure.Persistence.ApplicationDbContext))]
[Migration("20261009233000_AddJobCommercialTerms")]
public partial class AddJobCommercialTerms : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(
            name: "sourcing_target",
            schema: "public",
            table: "job",
            type: "integer",
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "sourcing_price_per_cv",
            schema: "public",
            table: "job",
            type: "numeric(18,2)",
            precision: 18,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<decimal>(
            name: "fee_multiplier",
            schema: "public",
            table: "job",
            type: "numeric(5,2)",
            precision: 5,
            scale: 2,
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "warranty_days",
            schema: "public",
            table: "job",
            type: "integer",
            nullable: true);

        migrationBuilder.AddColumn<int>(
            name: "payment_due_days",
            schema: "public",
            table: "job",
            type: "integer",
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "payment_due_days",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "warranty_days",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "fee_multiplier",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "sourcing_price_per_cv",
            schema: "public",
            table: "job");

        migrationBuilder.DropColumn(
            name: "sourcing_target",
            schema: "public",
            table: "job");
    }
}
