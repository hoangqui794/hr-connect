using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Repositories;

public sealed class UserRepositoryTests
{
    [Fact]
    public async Task GetByIdWithActiveRolesAsync_LoadsOnlyActiveAssignmentsWithRoleState()
    {
        await using var context = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var userId = Guid.NewGuid();
        var candidateRole = CreateRole("CANDIDATE", true);
        var revokedRole = CreateRole("AFFILIATE_RECRUITER", true);
        context.AppUsers.Add(new AppUser
        {
            UserId = userId,
            Email = "candidate@example.com",
            PasswordHash = "hash",
            Status = "ACTIVE"
        });
        context.Roles.AddRange(candidateRole, revokedRole);
        context.UserRoles.AddRange(
            CreateAssignment(userId, candidateRole.RoleId, "ACTIVE"),
            CreateAssignment(userId, revokedRole.RoleId, "REVOKED"));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var user = await new UserRepository(context).GetByIdWithActiveRolesAsync(userId);

        user.Should().NotBeNull();
        user!.UserRoleUsers.Should().ContainSingle();
        user.UserRoleUsers.Single().Role.Code.Should().Be("CANDIDATE");
        user.UserRoleUsers.Single().Role.IsActive.Should().BeTrue();
    }

    private static Role CreateRole(string code, bool isActive) => new()
    {
        RoleId = Guid.NewGuid(),
        Code = code,
        Name = code,
        IsActive = isActive
    };

    private static UserRole CreateAssignment(Guid userId, Guid roleId, string status) => new()
    {
        UserId = userId,
        RoleId = roleId,
        Status = status,
        AssignmentSource = "SYSTEM",
        AssignedAt = DateTime.UtcNow
    };
}
