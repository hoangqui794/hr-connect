using System.Net;
using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Services.Audit;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace HRConnect.UnitTests.Services.Audit;

public class AuditLogServiceTests
{
    [Fact]
    public async Task AddAsync_UsesRequestContextAndDoesNotCommitByItself()
    {
        await using var db = CreateDbContext();
        var userId = Guid.NewGuid();
        var correlationId = Guid.NewGuid();
        var requestContext = new Mock<IRequestContext>();
        requestContext.SetupGet(context => context.UserId).Returns(userId);
        requestContext.SetupGet(context => context.CorrelationId).Returns(correlationId);
        requestContext.SetupGet(context => context.IpAddress).Returns(IPAddress.Loopback);
        requestContext.SetupGet(context => context.UserAgent).Returns("test-agent");
        var service = new AuditLogService(db, requestContext.Object);
        var entityId = Guid.NewGuid();

        await service.AddAsync(new AuditEntry
        {
            Action = "CV_UPDATED",
            EntityType = "CANDIDATE_CV",
            EntityId = entityId,
            OldValues = new { title = "Old" },
            NewValues = new { title = "New" }
        });

        (await db.AuditLogs.CountAsync()).Should().Be(0);
        var pending = db.AuditLogs.Local.Should().ContainSingle().Subject;
        pending.ActorUserId.Should().Be(userId);
        pending.CorrelationId.Should().Be(correlationId);
        pending.IpAddress.Should().Be(IPAddress.Loopback);
        pending.UserAgent.Should().Be("test-agent");
        pending.EntityId.Should().Be(entityId);
        pending.OldValues.Should().Contain("Old");
        pending.NewValues.Should().Contain("New");
    }

    [Fact]
    public async Task AddAsync_RedactsSensitivePropertyNamesRecursively()
    {
        await using var db = CreateDbContext();
        var service = new AuditLogService(db, Mock.Of<IRequestContext>());

        await service.AddAsync(new AuditEntry
        {
            Action = "AUTH_TEST",
            NewValues = new
            {
                email = "safe@example.com",
                password = "do-not-store",
                nested = new { refreshToken = "do-not-store-either" }
            }
        });

        var json = db.AuditLogs.Local.Single().NewValues!;
        using var document = JsonDocument.Parse(json);
        document.RootElement.GetProperty("email").GetString().Should().Be("safe@example.com");
        document.RootElement.GetProperty("password").GetString().Should().Be("[REDACTED]");
        document.RootElement.GetProperty("nested").GetProperty("refreshToken").GetString()
            .Should().Be("[REDACTED]");
        json.Should().NotContain("do-not-store");
    }

    [Fact]
    public async Task AddAsync_WhenJsonIsTooLarge_RejectsIt()
    {
        await using var db = CreateDbContext();
        var service = new AuditLogService(db, Mock.Of<IRequestContext>());

        var action = () => service.AddAsync(new AuditEntry
        {
            Action = "OVERSIZED",
            NewValues = new { value = new string('x', 20_000) }
        });

        await action.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*must not exceed*");
        db.AuditLogs.Local.Should().BeEmpty();
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }
}
