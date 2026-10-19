using FluentAssertions;
using HRConnect.Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Npgsql;
using Xunit;

namespace HRConnect.UnitTests.Features.Internal;

/// <summary>BE-6 (bug list 17/10): DATABASE_URL support and a clear error for a localhost database on a server.</summary>
public class DatabaseConnectionStringTests
{
    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();

    [Fact]
    public void DatabaseUrl_ShouldWin_AndBeConvertedToNpgsql()
    {
        var result = DatabaseConnectionString.Resolve(Config(
            ("DATABASE_URL", "postgresql://app%40x:p%3Ass@db.example.com:6543/hr_db"),
            ("ConnectionStrings:DefaultConnection", "Host=localhost;Database=other"),
            ("ASPNETCORE_ENVIRONMENT", "Production")));

        var builder = new NpgsqlConnectionStringBuilder(result);
        builder.Host.Should().Be("db.example.com");
        builder.Port.Should().Be(6543);
        builder.Database.Should().Be("hr_db");
        builder.Username.Should().Be("app@x");
        builder.Password.Should().Be("p:ss");
        builder.SslMode.Should().Be(SslMode.Require);
    }

    [Fact]
    public void DatabaseUrl_ShouldKeepExplicitSslMode()
    {
        var builder = new NpgsqlConnectionStringBuilder(DatabaseConnectionString.FromUrl("postgres://u:p@db.example.com/x?sslmode=disable"));

        builder.SslMode.Should().Be(SslMode.Disable);
        builder.Port.Should().Be(5432);
    }

    [Theory]
    [InlineData("Production", null)]
    [InlineData(null, "true")]
    public void LocalhostOnServer_ShouldFailWithClearMessage(string? environment, string? render)
    {
        var act = () => DatabaseConnectionString.Resolve(Config(
            ("ConnectionStrings:DefaultConnection", "Host=127.0.0.1;Port=5432;Database=hr"),
            ("ASPNETCORE_ENVIRONMENT", environment), ("RENDER", render)));

        act.Should().Throw<InvalidOperationException>().WithMessage("*localhost*");
    }

    [Theory]
    [InlineData("Development")]
    [InlineData(null)]
    public void LocalhostInDevelopmentOrDesignTime_ShouldBeAllowed(string? environment)
    {
        var result = DatabaseConnectionString.Resolve(Config(
            ("ConnectionStrings:DefaultConnection", "Host=localhost;Database=hr"), ("ASPNETCORE_ENVIRONMENT", environment)));

        result.Should().Contain("localhost");
    }

    [Fact]
    public void Missing_ShouldFailWithClearMessage()
    {
        var act = () => DatabaseConnectionString.Resolve(Config());

        act.Should().Throw<InvalidOperationException>().WithMessage("*DATABASE_URL*");
    }
}
