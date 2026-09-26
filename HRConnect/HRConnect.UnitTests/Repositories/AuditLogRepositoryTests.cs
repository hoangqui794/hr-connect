using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Repositories;

public class AuditLogRepositoryTests
{
    [Fact]
    public async Task GetListAsync_AppliesFiltersAndReturnsNewestFirst()
    {
        await using var context = CreateDbContext();
        var actorId = Guid.NewGuid();
        var entityId = Guid.NewGuid();
        var correlationId = Guid.NewGuid();
        var actor = new AppUser
        {
            UserId = actorId,
            Email = "admin@example.com",
            DisplayName = "Platform Admin",
            PasswordHash = "hash",
            Status = "ACTIVE"
        };
        var older = CreateLog(1, actorId, entityId, correlationId, new DateTime(2026, 9, 26, 1, 0, 0, DateTimeKind.Utc));
        var newer = CreateLog(2, actorId, entityId, correlationId, new DateTime(2026, 9, 26, 2, 0, 0, DateTimeKind.Utc));
        var unrelated = new AuditLog
        {
            AuditLogId = 3,
            Action = "JOB_CREATED",
            CreatedAt = new DateTime(2026, 9, 26, 3, 0, 0, DateTimeKind.Utc)
        };
        await context.AppUsers.AddAsync(actor);
        await context.AuditLogs.AddRangeAsync(older, newer, unrelated);
        await context.SaveChangesAsync();
        var repository = new AuditLogRepository(context);

        var (items, total) = await repository.GetListAsync(
            actorId,
            "CV_UPDATED",
            "CANDIDATE_CV",
            entityId,
            correlationId,
            new DateTime(2026, 9, 26, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 9, 26, 23, 59, 59, DateTimeKind.Utc),
            page: 1,
            pageSize: 20);

        total.Should().Be(2);
        items.Select(item => item.AuditLogId).Should().Equal(2, 1);
        items[0].ActorUser.Should().NotBeNull();
        items[0].ActorUser!.Email.Should().Be("admin@example.com");
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static AuditLog CreateLog(
        long id,
        Guid actorId,
        Guid entityId,
        Guid correlationId,
        DateTime createdAt) => new()
    {
        AuditLogId = id,
        ActorUserId = actorId,
        Action = "CV_UPDATED",
        EntityType = "CANDIDATE_CV",
        EntityId = entityId,
        CorrelationId = correlationId,
        CreatedAt = createdAt
    };
}
