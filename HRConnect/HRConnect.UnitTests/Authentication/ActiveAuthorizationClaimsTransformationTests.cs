using System.Security.Claims;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Authentication;
using Moq;

namespace HRConnect.UnitTests.Authentication;

public class ActiveAuthorizationClaimsTransformationTests
{
    [Fact]
    public async Task TransformAsync_ReplacesStaleClaimsWithCurrentActiveAuthorization()
    {
        var userId = Guid.NewGuid();
        var user = new AppUser { UserId = userId, Status = "ACTIVE" };
        var activePermission = new Permission { Code = "job.view", IsActive = true };
        var disabledPermission = new Permission { Code = "admin.delete", IsActive = false };
        var role = new Role { Code = "CANDIDATE", IsActive = true };
        role.RolePermissions.Add(new RolePermission { Permission = activePermission });
        role.RolePermissions.Add(new RolePermission { Permission = disabledPermission });
        user.UserRoleUsers.Add(new UserRole { Status = "ACTIVE", Role = role });

        var repository = new Mock<IUserRepository>();
        repository.Setup(item => item.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        var transformer = new ActiveAuthorizationClaimsTransformation(repository.Object);
        var principal = Principal(userId,
            new Claim(ClaimTypes.Role, "ADMIN"),
            new Claim("permission", "admin.delete"));

        var result = await transformer.TransformAsync(principal);

        result.IsInRole("CANDIDATE").Should().BeTrue();
        result.IsInRole("ADMIN").Should().BeFalse();
        result.HasClaim("permission", "job.view").Should().BeTrue();
        result.HasClaim("permission", "admin.delete").Should().BeFalse();
    }

    [Fact]
    public async Task TransformAsync_WhenUserIsNoLongerActive_RemovesAllAuthorizationClaims()
    {
        var userId = Guid.NewGuid();
        var repository = new Mock<IUserRepository>();
        repository.Setup(item => item.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser { UserId = userId, Status = "SUSPENDED" });
        var transformer = new ActiveAuthorizationClaimsTransformation(repository.Object);

        var result = await transformer.TransformAsync(Principal(userId,
            new Claim(ClaimTypes.Role, "ADMIN"),
            new Claim("permission", "user.manage")));

        result.Claims.Should().NotContain(claim =>
            claim.Type == ClaimTypes.Role || claim.Type == "permission");
    }

    private static ClaimsPrincipal Principal(Guid userId, params Claim[] claims)
    {
        var allClaims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId.ToString()) };
        allClaims.AddRange(claims);
        return new ClaimsPrincipal(new ClaimsIdentity(allClaims, "Bearer"));
    }
}
