using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRConnect.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReplacePrivateJobVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE public.job SET visibility = 'INTERNAL_ONLY' WHERE visibility = 'PRIVATE';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE public.job SET visibility = 'PRIVATE' WHERE visibility = 'INTERNAL_ONLY';");
        }
    }
}
