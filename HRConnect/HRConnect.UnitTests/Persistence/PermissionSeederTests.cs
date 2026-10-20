using System.Reflection;
using FluentAssertions;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace HRConnect.UnitTests.Persistence;

public class PermissionSeederTests
{
    [Fact]
    public void EmbeddedSeed_AssignsAttributionViewOwnToAffiliateRecruiter()
    {
        var field = typeof(DatabaseSeeder).GetField(
            "EmbeddedPermissionSeedSql",
            BindingFlags.NonPublic | BindingFlags.Static);

        field.Should().NotBeNull();
        var sql = field!.GetRawConstantValue().Should().BeOfType<string>().Subject;

        AssertAffiliateAttributionPermission(sql);
    }

    [Fact]
    public void PermissionFile_AssignsAttributionViewOwnToAffiliateRecruiter()
    {
        var permissionFile = FindPermissionFile();
        permissionFile.Should().NotBeNull("Permission.md is the primary permission seed source");

        AssertAffiliateAttributionPermission(File.ReadAllText(permissionFile!));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void PermissionSeed_AssignsCandidateIdentityManagementToCandidate(bool embedded)
    {
        var sql = embedded
            ? GetEmbeddedSeedSql()
            : File.ReadAllText(FindPermissionFile()!);

        sql.Should().Contain("('candidate.identity.manage_own'");
        var roleEnd = sql.IndexOf("WHERE r.code = 'CANDIDATE'", StringComparison.Ordinal);
        roleEnd.Should().BeGreaterThan(0);
        var roleStart = sql.LastIndexOf("JOIN public.permission p", roleEnd, StringComparison.Ordinal);
        roleStart.Should().BeGreaterThanOrEqualTo(0);
        sql[roleStart..roleEnd].Should().Contain("'candidate.identity.manage_own'");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void PermissionSeed_AssignsCandidateIdentityReviewToPlatformAdmin(bool embedded)
    {
        var sql = embedded
            ? GetEmbeddedSeedSql()
            : File.ReadAllText(FindPermissionFile()!);

        sql.Should().Contain("('candidate.identity.review'");
        var roleEnd = sql.IndexOf("WHERE r.code = 'PLATFORM_ADMIN'", StringComparison.Ordinal);
        roleEnd.Should().BeGreaterThan(0);
        var roleStart = sql.LastIndexOf("JOIN public.permission p", roleEnd, StringComparison.Ordinal);
        roleStart.Should().BeGreaterThanOrEqualTo(0);
        sql[roleStart..roleEnd].Should().Contain("'candidate.identity.review'");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void PermissionSeed_AssignsCandidateDuplicatePermissionsOnlyToPlatformAdmin(bool embedded)
    {
        var sql = embedded
            ? GetEmbeddedSeedSql()
            : File.ReadAllText(FindPermissionFile()!);

        sql.Should().Contain("('candidate_duplicate.view'");
        sql.Should().Contain("('candidate_duplicate.resolve'");
        var roleEnd = sql.IndexOf("WHERE r.code = 'PLATFORM_ADMIN'", StringComparison.Ordinal);
        roleEnd.Should().BeGreaterThan(0);
        var roleStart = sql.LastIndexOf("JOIN public.permission p", roleEnd, StringComparison.Ordinal);
        roleStart.Should().BeGreaterThanOrEqualTo(0);
        var platformAdminGrant = sql[roleStart..roleEnd];
        platformAdminGrant.Should().Contain("'candidate_duplicate.view'");
        platformAdminGrant.Should().Contain("'candidate_duplicate.resolve'");
    }

    [Fact]
    public void RbacMigration_InstallsCatalogAndProtectsManagementPermissions()
    {
        var builder = new MigrationBuilder("Npgsql.EntityFrameworkCore.PostgreSQL");
        new RbacMigrationHarness().BuildUp(builder);
        var sql = string.Join("\n", builder.Operations.OfType<SqlOperation>().Select(x => x.Sql));

        sql.Should().Contain("INSERT INTO public.role");
        sql.Should().Contain("'PLATFORM_ADMIN'");
        sql.Should().Contain("('role.manage', 'role', 'manage'");
        sql.Should().Contain("SET is_delegable = false");
        sql.Should().Contain("'permission.manage'");
        sql.Should().Contain("Migrated legacy revoked assignment");

        var lifecycle = builder.Operations.OfType<AddCheckConstraintOperation>()
            .Single(x => x.Name == "ck_user_role_lifecycle");
        lifecycle.Sql.Should().Contain("status = 'ACTIVE'");
        lifecycle.Sql.Should().Contain("status = 'REVOKED'");
    }

    private static void AssertAffiliateAttributionPermission(string sql)
    {
        sql.Should().Contain("('attribution.view_own'");

        var roleEnd = sql.IndexOf("WHERE r.code = 'AFFILIATE_RECRUITER'", StringComparison.Ordinal);
        roleEnd.Should().BeGreaterThan(0);
        var roleStart = sql.LastIndexOf("JOIN public.permission p", roleEnd, StringComparison.Ordinal);
        roleStart.Should().BeGreaterThanOrEqualTo(0);

        sql[roleStart..roleEnd].Should().Contain("'attribution.view_own'");
    }

    private static string GetEmbeddedSeedSql()
    {
        var field = typeof(DatabaseSeeder).GetField(
            "EmbeddedPermissionSeedSql",
            BindingFlags.NonPublic | BindingFlags.Static);
        field.Should().NotBeNull();
        return field!.GetRawConstantValue().Should().BeOfType<string>().Subject;
    }

    private static string? FindPermissionFile()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            var directPath = Path.Combine(directory.FullName, "Permission.md");
            if (File.Exists(directPath)) return directPath;

            var solutionPath = Path.Combine(directory.FullName, "HRConnect", "Permission.md");
            if (File.Exists(solutionPath)) return solutionPath;

            directory = directory.Parent;
        }

        return null;
    }

    private sealed class RbacMigrationHarness : AddProductionRbacManagement
    {
        public void BuildUp(MigrationBuilder builder) => Up(builder);
    }
}
