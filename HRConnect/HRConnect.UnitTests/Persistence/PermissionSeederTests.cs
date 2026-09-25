using System.Reflection;
using FluentAssertions;
using HRConnect.Infrastructure.Persistence;

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

    private static void AssertAffiliateAttributionPermission(string sql)
    {
        sql.Should().Contain("('attribution.view_own'");

        var roleEnd = sql.IndexOf("WHERE r.code = 'AFFILIATE_RECRUITER'", StringComparison.Ordinal);
        roleEnd.Should().BeGreaterThan(0);
        var roleStart = sql.LastIndexOf("JOIN public.permission p", roleEnd, StringComparison.Ordinal);
        roleStart.Should().BeGreaterThanOrEqualTo(0);

        sql[roleStart..roleEnd].Should().Contain("'attribution.view_own'");
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
}
