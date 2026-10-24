using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlacementReconciliationResolutionAction : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "resolution_action",
                schema: "public",
                table: "placement_reconciliation",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_placement_reconciliation_resolution_action",
                schema: "public",
                table: "placement_reconciliation",
                sql: "resolution_action IS NULL OR resolution_action IN ('CONFIRM_REPORTED_OUTCOME','REOPEN_FOR_CLIENT_CONFIRMATION')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_placement_reconciliation_resolution_action",
                schema: "public",
                table: "placement_reconciliation");

            migrationBuilder.DropColumn(
                name: "resolution_action",
                schema: "public",
                table: "placement_reconciliation");
        }
    }
}
