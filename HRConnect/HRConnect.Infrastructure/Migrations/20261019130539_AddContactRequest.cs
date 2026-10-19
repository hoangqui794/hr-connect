using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddContactRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "contact_request",
                schema: "public",
                columns: table => new
                {
                    contact_request_id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    full_name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    company_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    service_interest = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    consent_accepted = table.Column<bool>(type: "boolean", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValueSql: "'NEW'::character varying"),
                    handled_by = table.Column<Guid>(type: "uuid", nullable: true),
                    note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    source_ip_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("contact_request_pkey", x => x.contact_request_id);
                    table.CheckConstraint("ck_contact_request_consent", "consent_accepted");
                    table.CheckConstraint("ck_contact_request_service", "service_interest IN ('HEADHUNT_COD','CV_SOURCING','CV_APPLICATION','OTHER')");
                    table.CheckConstraint("ck_contact_request_status", "status IN ('NEW','CONTACTED','CLOSED')");
                },
                comment: "BE-04 A: public contact form. Stored only with consent (Decree 13/2023).");

            migrationBuilder.CreateIndex(
                name: "idx_contact_request_ip_created",
                schema: "public",
                table: "contact_request",
                columns: new[] { "source_ip_hash", "created_at" });

            migrationBuilder.CreateIndex(
                name: "idx_contact_request_status_created",
                schema: "public",
                table: "contact_request",
                columns: new[] { "status", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "contact_request",
                schema: "public");
        }
    }
}
