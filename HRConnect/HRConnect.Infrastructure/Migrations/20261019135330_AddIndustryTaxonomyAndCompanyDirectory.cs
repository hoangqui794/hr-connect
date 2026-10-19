using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIndustryTaxonomyAndCompanyDirectory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "company_size_id",
                schema: "public",
                table: "company",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "featured_order",
                schema: "public",
                table: "company",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "industry_id",
                schema: "public",
                table: "company",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_featured",
                schema: "public",
                table: "company",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "company_size",
                schema: "public",
                columns: table => new
                {
                    company_size_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    code = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    min_employees = table.Column<int>(type: "integer", nullable: false),
                    max_employees = table.Column<int>(type: "integer", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("company_size_pkey", x => x.company_size_id);
                },
                comment: "BE-02 A: company size bands, seeded from Seed/Data/company_size.csv.");

            migrationBuilder.CreateTable(
                name: "industry",
                schema: "public",
                columns: table => new
                {
                    industry_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    name_en = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    name_vi = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    level = table.Column<short>(type: "smallint", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("industry_pkey", x => x.industry_id);
                    table.CheckConstraint("ck_industry_level", "level BETWEEN 1 AND 3");
                    table.ForeignKey(
                        name: "industry_parent_id_fkey",
                        column: x => x.parent_id,
                        principalSchema: "public",
                        principalTable: "industry",
                        principalColumn: "industry_id",
                        onDelete: ReferentialAction.Restrict);
                },
                comment: "BE-02 A: industry taxonomy L1/L2/L3, seeded from Seed/Data/industry.csv, edited by Platform Admin.");

            migrationBuilder.CreateIndex(
                name: "idx_company_featured",
                schema: "public",
                table: "company",
                columns: new[] { "is_featured", "featured_order" });

            migrationBuilder.CreateIndex(
                name: "idx_company_industry",
                schema: "public",
                table: "company",
                column: "industry_id");

            migrationBuilder.CreateIndex(
                name: "IX_company_company_size_id",
                schema: "public",
                table: "company",
                column: "company_size_id");

            migrationBuilder.CreateIndex(
                name: "company_size_code_key",
                schema: "public",
                table: "company_size",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_industry_parent",
                schema: "public",
                table: "industry",
                columns: new[] { "parent_id", "is_active", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "industry_code_key",
                schema: "public",
                table: "industry",
                column: "code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "company_company_size_id_fkey",
                schema: "public",
                table: "company",
                column: "company_size_id",
                principalSchema: "public",
                principalTable: "company_size",
                principalColumn: "company_size_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "company_industry_id_fkey",
                schema: "public",
                table: "company",
                column: "industry_id",
                principalSchema: "public",
                principalTable: "industry",
                principalColumn: "industry_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "company_company_size_id_fkey",
                schema: "public",
                table: "company");

            migrationBuilder.DropForeignKey(
                name: "company_industry_id_fkey",
                schema: "public",
                table: "company");

            migrationBuilder.DropTable(
                name: "company_size",
                schema: "public");

            migrationBuilder.DropTable(
                name: "industry",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "idx_company_featured",
                schema: "public",
                table: "company");

            migrationBuilder.DropIndex(
                name: "idx_company_industry",
                schema: "public",
                table: "company");

            migrationBuilder.DropIndex(
                name: "IX_company_company_size_id",
                schema: "public",
                table: "company");

            migrationBuilder.DropColumn(
                name: "company_size_id",
                schema: "public",
                table: "company");

            migrationBuilder.DropColumn(
                name: "featured_order",
                schema: "public",
                table: "company");

            migrationBuilder.DropColumn(
                name: "industry_id",
                schema: "public",
                table: "company");

            migrationBuilder.DropColumn(
                name: "is_featured",
                schema: "public",
                table: "company");
        }
    }
}
