using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Repositories;

public sealed class AffiliateProfileRepositoryTests
{
    [Fact]
    public async Task GetByUserIdWithDetailsAsync_LoadsUserRoleAssignmentAndRoleState()
    {
        await using var context = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
        var userId = Guid.NewGuid();
        var roleId = Guid.NewGuid();
        context.AppUsers.Add(new AppUser
        {
            UserId = userId,
            Email = "affiliate@example.com",
            PasswordHash = "hash",
            Status = "ACTIVE"
        });
        context.Roles.Add(new Role
        {
            RoleId = roleId,
            Code = "AFFILIATE",
            Name = "Affiliate",
            IsActive = true
        });
        context.UserRoles.Add(new UserRole
        {
            UserId = userId,
            RoleId = roleId,
            Status = "ACTIVE",
            AssignmentSource = "ADMIN",
            AssignedAt = DateTime.UtcNow
        });
        context.AffiliateProfiles.Add(new AffiliateProfile
        {
            AffiliateId = Guid.NewGuid(),
            UserId = userId,
            AffiliateType = "STANDARD",
            Status = "ACTIVE"
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var profile = await new AffiliateProfileRepository(context)
            .GetByUserIdWithDetailsAsync(userId);

        profile.Should().NotBeNull();
        profile!.User.Status.Should().Be("ACTIVE");
        profile.User.UserRoleUsers.Should().ContainSingle(userRole =>
            userRole.Status == "ACTIVE" &&
            userRole.Role.Code == "AFFILIATE" &&
            userRole.Role.IsActive);
    }
}
