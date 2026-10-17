using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOfferSalarySemantics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "salary_basis",
                schema: "public",
                table: "offer",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "salary_period",
                schema: "public",
                table: "offer",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            // Existing offers predate the explicit salary semantics. Preserve their
            // historical interpretation: the stored amount was monthly gross salary.
            migrationBuilder.Sql(
                """
                UPDATE public.offer
                SET salary_basis = 'GROSS', salary_period = 'MONTHLY'
                WHERE salary IS NOT NULL;
                """);

            migrationBuilder.AddCheckConstraint(
                name: "ck_offer_salary_basis",
                schema: "public",
                table: "offer",
                sql: "salary_basis IS NULL OR salary_basis IN ('GROSS','NET')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_offer_salary_period",
                schema: "public",
                table: "offer",
                sql: "salary_period IS NULL OR salary_period IN ('MONTHLY','ANNUAL')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_offer_salary_basis",
                schema: "public",
                table: "offer");

            migrationBuilder.DropCheckConstraint(
                name: "ck_offer_salary_period",
                schema: "public",
                table: "offer");

            migrationBuilder.DropColumn(
                name: "salary_basis",
                schema: "public",
                table: "offer");

            migrationBuilder.DropColumn(
                name: "salary_period",
                schema: "public",
                table: "offer");
        }
    }
}
