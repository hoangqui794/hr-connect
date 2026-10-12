using System.Text;
using FluentAssertions;
using HRConnect.Presentation.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace HRConnect.UnitTests.HealthChecks;

public sealed class HealthCheckResponseWriterTests
{
    [Fact]
    public async Task WriteAsync_ShouldReturnOperationalStatusWithoutLeakingInternalErrors()
    {
        var context = new DefaultHttpContext();
        await using var responseBody = new MemoryStream();
        context.Response.Body = responseBody;
        var report = new HealthReport(
            new Dictionary<string, HealthReportEntry>
            {
                ["postgresql"] = new(
                    HealthStatus.Unhealthy,
                    "internal database description",
                    TimeSpan.FromMilliseconds(12),
                    new InvalidOperationException("connection string secret"),
                    new Dictionary<string, object> { ["server"] = "private-host" },
                    ["ready"])
            },
            TimeSpan.FromMilliseconds(13));

        await HealthCheckResponseWriter.WriteAsync(context, report);

        responseBody.Position = 0;
        var response = await new StreamReader(responseBody, Encoding.UTF8).ReadToEndAsync();
        response.Should().Contain("\"status\":\"Unhealthy\"");
        response.Should().Contain("\"name\":\"postgresql\"");
        response.Should().NotContain("connection string secret");
        response.Should().NotContain("private-host");
        response.Should().NotContain("internal database description");
        context.Response.ContentType.Should().Be("application/json; charset=utf-8");
        context.Response.Headers.CacheControl.ToString().Should().Be("no-store, no-cache");
    }
}
