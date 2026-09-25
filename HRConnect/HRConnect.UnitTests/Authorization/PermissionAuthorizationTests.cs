using System.Security.Claims;
using FluentAssertions;
using HRConnect.Presentation.Authorization;

namespace HRConnect.UnitTests.Authorization;

public class PermissionAuthorizationTests
{
    [Theory]
    [InlineData("cv.create")]
    public void HasPermission_AllowsExactClaimAndRejectsMissingClaim(string permission)
    {
        var allowed = new ClaimsPrincipal(new ClaimsIdentity(
            new[] { new Claim("permission", permission) }, "test"));
        var denied = new ClaimsPrincipal(new ClaimsIdentity(authenticationType: "test"));

        PermissionAuthorization.HasPermission(allowed, permission).Should().BeTrue();
        PermissionAuthorization.HasPermission(denied, permission).Should().BeFalse();
        PermissionAuthorization.HasPermission(allowed, permission + ".other").Should().BeFalse();
    }
}
