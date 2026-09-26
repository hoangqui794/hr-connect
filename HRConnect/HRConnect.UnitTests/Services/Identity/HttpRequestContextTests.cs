using System.Net;
using System.Security.Claims;
using FluentAssertions;
using HRConnect.Infrastructure.Services.Identity;
using Microsoft.AspNetCore.Http;

namespace HRConnect.UnitTests.Services.Identity;

public class HttpRequestContextTests
{
    [Fact]
    public void Context_ReadsAuthenticatedRequestMetadata()
    {
        var userId = Guid.NewGuid();
        var correlationId = Guid.NewGuid();
        var httpContext = new DefaultHttpContext
        {
            TraceIdentifier = correlationId.ToString(),
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "Bearer"))
        };
        httpContext.Connection.RemoteIpAddress = IPAddress.Parse("127.0.0.2");
        httpContext.Request.Headers.UserAgent = "unit-test-agent";
        var accessor = new HttpContextAccessor { HttpContext = httpContext };

        var context = new HttpRequestContext(accessor);

        context.UserId.Should().Be(userId);
        context.CorrelationId.Should().Be(correlationId);
        context.IpAddress.Should().Be(IPAddress.Parse("127.0.0.2"));
        context.UserAgent.Should().Be("unit-test-agent");
    }
}
