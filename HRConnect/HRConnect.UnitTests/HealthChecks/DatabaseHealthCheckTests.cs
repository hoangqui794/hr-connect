using FluentAssertions;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Presentation.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging.Abstractions;

namespace HRConnect.UnitTests.HealthChecks;

public sealed class DatabaseHealthCheckTests
{
    [Fact]
    public async Task CheckHealthAsync_WhenDatabaseIsAvailable_ShouldReturnHealthy()
    {
        await using var provider = BuildServiceProvider(options =>
            options.UseInMemoryDatabase($"health-{Guid.NewGuid()}"));
        var healthCheck = CreateHealthCheck(provider);

        var result = await healthCheck.CheckHealthAsync(new HealthCheckContext());

        result.Status.Should().Be(HealthStatus.Healthy);
    }

    [Fact]
    public async Task CheckHealthAsync_WhenDatabaseIsUnavailable_ShouldReturnUnhealthyWithoutThrowing()
    {
        await using var provider = BuildServiceProvider(options =>
            options.UseNpgsql(
                "Host=127.0.0.1;Port=1;Database=unavailable;Username=unavailable;Password=unavailable;Timeout=1;Command Timeout=1"));
        var healthCheck = CreateHealthCheck(provider);

        var result = await healthCheck.CheckHealthAsync(new HealthCheckContext());

        result.Status.Should().Be(HealthStatus.Unhealthy);
        result.Exception.Should().BeNull();
    }

    [Fact]
    public async Task CheckHealthAsync_WhenPostgresConnectionIsProvided_ShouldConnectSuccessfully()
    {
        var connectionString = Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return;
        }

        await using var provider = BuildServiceProvider(options => options.UseNpgsql(connectionString));
        var healthCheck = CreateHealthCheck(provider);

        var result = await healthCheck.CheckHealthAsync(new HealthCheckContext());

        result.Status.Should().Be(HealthStatus.Healthy);
    }

    private static ServiceProvider BuildServiceProvider(
        Action<DbContextOptionsBuilder> configureDatabase)
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(configureDatabase);
        return services.BuildServiceProvider();
    }

    private static DatabaseHealthCheck CreateHealthCheck(IServiceProvider provider) =>
        new(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<DatabaseHealthCheck>.Instance);
}
