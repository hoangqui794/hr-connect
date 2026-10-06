using System.Net;
using System.Security.Claims;
using FluentAssertions;
using HRConnect.Presentation.RateLimiting;
using Microsoft.AspNetCore.Http;

namespace HRConnect.UnitTests.Presentation.RateLimiting;

public class RateLimitIdentityTests
{
    [Fact]
    public void UserAndIp_UsesAuthenticatedUserAndNormalizedIp()
    {
        var userId = Guid.NewGuid();
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "Bearer"))
        };
        context.Connection.RemoteIpAddress = IPAddress.Parse("::ffff:203.0.113.10");

        var key = RateLimitIdentity.UserAndIp(context);

        key.Should().Be($"user:{userId}:ip:203.0.113.10");
    }

    [Fact]
    public void UserAndIp_FallsBackToSubClaim()
    {
        var userId = Guid.NewGuid();
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim("sub", userId.ToString())], "Bearer"))
        };
        context.Connection.RemoteIpAddress = IPAddress.Parse("2001:db8::1");

        RateLimitIdentity.UserAndIp(context)
            .Should().Be($"user:{userId}:ip:2001:db8::1");
    }
}
