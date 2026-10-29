using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <summary>
    /// Replacing or deleting a company logo queues a cleanup job for the old company-logos/ object;
    /// the old constraint only allowed avatars/ keys, so those uploads failed with 500.
    /// The experience-year columns were already changed by SupportDecimalExperienceYears (raw SQL);
    /// this migration only brings the model snapshot in line for them.
    /// </summary>
    public partial class AllowCompanyLogoStorageCleanup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_storage_cleanup_job_avatar_namespace",
                schema: "public",
                table: "storage_cleanup_job");

            migrationBuilder.AddCheckConstraint(
                name: "ck_storage_cleanup_job_object_namespace",
                schema: "public",
                table: "storage_cleanup_job",
                sql: "object_key LIKE 'avatars/%' OR object_key LIKE 'company-logos/%'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_storage_cleanup_job_object_namespace",
                schema: "public",
                table: "storage_cleanup_job");

            // Logo cleanup rows would violate the old avatar-only rule.
            migrationBuilder.Sql("DELETE FROM public.storage_cleanup_job WHERE object_key LIKE 'company-logos/%';");

            migrationBuilder.AddCheckConstraint(
                name: "ck_storage_cleanup_job_avatar_namespace",
                schema: "public",
                table: "storage_cleanup_job",
                sql: "object_key LIKE 'avatars/%'");
        }
    }
}
