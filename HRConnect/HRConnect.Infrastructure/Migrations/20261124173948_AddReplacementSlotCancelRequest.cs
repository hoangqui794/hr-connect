using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReplacementSlotCancelRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cancel_request_reason",
                schema: "public",
                table: "replacement_slot",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cancel_requested_at",
                schema: "public",
                table: "replacement_slot",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "cancel_requested_by",
                schema: "public",
                table: "replacement_slot",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cancel_request_reason",
                schema: "public",
                table: "replacement_slot");

            migrationBuilder.DropColumn(
                name: "cancel_requested_at",
                schema: "public",
                table: "replacement_slot");

            migrationBuilder.DropColumn(
                name: "cancel_requested_by",
                schema: "public",
                table: "replacement_slot");
        }
    }
}
