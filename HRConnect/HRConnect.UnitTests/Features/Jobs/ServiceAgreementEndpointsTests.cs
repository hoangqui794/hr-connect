using System.Reflection;
using System.Security.Claims;
using FluentAssertions;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Presentation.Endpoints.V1.Jobs;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

public class ServiceAgreementEndpointsTests
{
    private static ClaimsPrincipal BuildUser(string role, params string[] permissions)
    {
        var claims = new List<Claim> { new(ClaimTypes.Role, role) };
        foreach (var permission in permissions)
        {
            claims.Add(new Claim("permission", permission));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"));
    }

    [Theory]
    [InlineData("INTERNAL_HR", "job.review")]
    [InlineData("INTERNAL_HR", "job.publish")]
    [InlineData("PLATFORM_ADMIN", "job.review")]
    [InlineData("PLATFORM_ADMIN", "job.publish")]
    public void ReviewerCan_BackofficeWithMatchingPermissionClaim_ShouldReturnTrue(string role, string permission)
    {
        var user = BuildUser(role, permission);

        ServiceAgreementEndpoints.ReviewerCan(user, permission).Should().BeTrue();
    }

    [Theory]
    [InlineData("INTERNAL_HR", "job.review")]
    [InlineData("INTERNAL_HR", "job.publish")]
    [InlineData("PLATFORM_ADMIN", "job.review")]
    [InlineData("PLATFORM_ADMIN", "job.publish")]
    public void ReviewerCan_BackofficeWithoutPermissionClaim_ShouldReturnFalse(string role, string requiredPermission)
    {
        var user = BuildUser(role);

        ServiceAgreementEndpoints.ReviewerCan(user, requiredPermission).Should().BeFalse();
    }

    [Fact]
    public void ReviewerCan_BackofficeWithWrongPermissionClaim_ShouldReturnFalse()
    {
        var user = BuildUser("INTERNAL_HR", "candidate.view");

        ServiceAgreementEndpoints.ReviewerCan(user, "job.review").Should().BeFalse();
    }

    [Fact]
    public void ReviewerCan_NonBackofficeRoleWithPermissionClaim_ShouldReturnFalse()
    {
        var user = BuildUser("CLIENT_COMPANY_USER", "job.review");

        ServiceAgreementEndpoints.ReviewerCan(user, "job.review").Should().BeFalse();
    }

    [Theory]
    [InlineData("INTERNAL_HR")]
    [InlineData("PLATFORM_ADMIN")]
    public void DatabaseSeeder_GrantsJobReviewAndPublishPermissions(string roleCode)
    {
        var field = typeof(DatabaseSeeder).GetField(
            "EmbeddedPermissionSeedSql",
            BindingFlags.NonPublic | BindingFlags.Static);
        var sql = field!.GetRawConstantValue() as string;
        sql.Should().NotBeNullOrWhiteSpace();

        var roleEnd = sql!.IndexOf($"WHERE r.code = '{roleCode}'", StringComparison.Ordinal);
        roleEnd.Should().BeGreaterThan(0);
        var roleStart = sql.LastIndexOf("JOIN public.permission p", roleEnd, StringComparison.Ordinal);
        var roleGrantBlock = sql[roleStart..roleEnd];

        roleGrantBlock.Should().Contain("'job.review'");
        roleGrantBlock.Should().Contain("'job.publish'");
    }
}
