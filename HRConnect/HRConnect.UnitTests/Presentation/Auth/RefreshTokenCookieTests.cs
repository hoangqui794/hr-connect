using FluentAssertions;
using HRConnect.Presentation.Endpoints.V1.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Moq;

namespace HRConnect.UnitTests.Presentation.Auth;

public class RefreshTokenCookieTests
{
    [Fact]
    public void Write_UsesStrictHttpOnlySecureCookieInProduction()
    {
        var context = new DefaultHttpContext();
        var expiresAt = DateTime.UtcNow.AddDays(7);

        RefreshTokenCookie.Write(context.Response, "secret-token", expiresAt, Environment(Environments.Production));

        var header = context.Response.Headers.SetCookie.ToString();
        var normalizedHeader = header.ToLowerInvariant();
        header.Should().Contain($"{RefreshTokenCookie.Name}=secret-token");
        normalizedHeader.Should().Contain("httponly");
        normalizedHeader.Should().Contain("secure");
        normalizedHeader.Should().Contain("samesite=strict");
        normalizedHeader.Should().Contain($"path={RefreshTokenCookie.Path}");
    }

    [Fact]
    public void Write_AllowsLocalHttpOnlyDuringDevelopment()
    {
        var context = new DefaultHttpContext();

        RefreshTokenCookie.Write(
            context.Response,
            "local-token",
            DateTime.UtcNow.AddDays(1),
            Environment(Environments.Development));

        var header = context.Response.Headers.SetCookie.ToString();
        var normalizedHeader = header.ToLowerInvariant();
        normalizedHeader.Should().Contain("httponly");
        normalizedHeader.Should().NotContain("; secure");
    }

    [Fact]
    public void Read_ReturnsCookieValue()
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Cookie = $"{RefreshTokenCookie.Name}=rotated-token";

        RefreshTokenCookie.Read(context.Request).Should().Be("rotated-token");
    }

    [Fact]
    public void Delete_ExpiresCookieOnTheAuthPath()
    {
        var context = new DefaultHttpContext();

        RefreshTokenCookie.Delete(context.Response, Environment(Environments.Production));

        var header = context.Response.Headers.SetCookie.ToString();
        var normalizedHeader = header.ToLowerInvariant();
        header.Should().Contain($"{RefreshTokenCookie.Name}=");
        normalizedHeader.Should().Contain($"path={RefreshTokenCookie.Path}");
        normalizedHeader.Should().Contain("expires=");
    }

    private static IHostEnvironment Environment(string name)
    {
        var environment = new Mock<IHostEnvironment>();
        environment.SetupGet(item => item.EnvironmentName).Returns(name);
        return environment.Object;
    }
}
