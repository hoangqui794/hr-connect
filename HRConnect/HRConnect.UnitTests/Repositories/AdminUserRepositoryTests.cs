using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Repositories;

public class AdminUserRepositoryTests
{
    [Fact]
    public async Task GetUsersAsync_AppliesSearchStatusRoleAndStablePaging()
    {
        await using var context = CreateDbContext();
        var candidateRole = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "CANDIDATE",
            Name = "Candidate",
            IsActive = true
        };
        var matching = CreateUser("linh@example.com", "Nguyen Thuy Linh", "ACTIVE", DateTime.UtcNow);
        matching.UserRoleUsers.Add(new UserRole
        {
            UserId = matching.UserId,
            RoleId = candidateRole.RoleId,
            Role = candidateRole,
            User = matching,
            Status = "ACTIVE",
            AssignmentSource = "TEST",
            AssignedAt = DateTime.UtcNow
        });
        var ignored = CreateUser("other@example.com", "Other User", "SUSPENDED", DateTime.UtcNow.AddMinutes(1));
        await context.AddRangeAsync(candidateRole, matching, ignored);
        await context.SaveChangesAsync();
        var repository = new AdminUserRepository(context);

        var (items, total) = await repository.GetUsersAsync(
            "LINH", "active", "candidate", 1, 20);

        total.Should().Be(1);
        items.Should().ContainSingle().Which.UserId.Should().Be(matching.UserId);
        items[0].UserRoleUsers.Should().ContainSingle();
    }

    [Fact]
    public async Task GetByIdWithRolesAsync_WhenTrackingFalse_DoesNotTrackUser()
    {
        await using var context = CreateDbContext();
        var user = CreateUser("user@example.com", "User", "ACTIVE", DateTime.UtcNow);
        await context.AppUsers.AddAsync(user);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var repository = new AdminUserRepository(context);

        var result = await repository.GetByIdWithRolesAsync(user.UserId);

        result.Should().NotBeNull();
        context.Entry(result!).State.Should().Be(EntityState.Detached);
    }

    private static ApplicationDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    private static AppUser CreateUser(
        string email,
        string displayName,
        string status,
        DateTime updatedAt) => new()
    {
        UserId = Guid.NewGuid(),
        Email = email,
        DisplayName = displayName,
        PasswordHash = "hash",
        Status = status,
        CreatedAt = updatedAt.AddDays(-1),
        UpdatedAt = updatedAt
    };
}
