using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Auth.Queries.GetCurrentUser;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Auth.GetCurrentUser;

public class GetCurrentUserQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<ICurrentUserService> _currentUserServiceMock;
    private readonly Mock<ILogger<GetCurrentUserQueryHandler>> _loggerMock;
    private readonly GetCurrentUserQueryHandler _handler;

    public GetCurrentUserQueryHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _currentUserServiceMock = new Mock<ICurrentUserService>();
        _loggerMock = new Mock<ILogger<GetCurrentUserQueryHandler>>();

        _handler = new GetCurrentUserQueryHandler(
            _userRepositoryMock.Object,
            _currentUserServiceMock.Object,
            _loggerMock.Object);
    }

    private static AppUser CreateUser(
        Guid userId,
        string email = "test@example.com",
        string displayName = "Test User",
        string status = "ACTIVE",
        DateTime? emailVerifiedAt = null)
    {
        return new AppUser
        {
            UserId = userId,
            Email = email,
            PasswordHash = "SuperSecretHashedPassword123!",
            DisplayName = displayName,
            Phone = "0987654321",
            AvatarUrl = "https://example.com/avatar.png",
            Status = status,
            EmailVerifiedAt = emailVerifiedAt ?? DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            UserRoleUsers = new List<UserRole>()
        };
    }

    private static UserRole CreateUserRole(Guid userId, string roleCode, string status = "ACTIVE", bool isRoleActive = true, List<string>? permissionCodes = null)
    {
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = roleCode,
            Name = roleCode,
            IsActive = isRoleActive,
            RolePermissions = new List<RolePermission>()
        };

        if (permissionCodes != null)
        {
            foreach (var code in permissionCodes)
            {
                var permission = new Permission
                {
                    PermissionId = Guid.NewGuid(),
                    Code = code,
                    Resource = code.Split('.')[0],
                    Action = code.Contains('.') ? code.Split('.')[1] : "access",
                    IsActive = true
                };

                role.RolePermissions.Add(new RolePermission
                {
                    RoleId = role.RoleId,
                    PermissionId = permission.PermissionId,
                    Role = role,
                    Permission = permission
                });
            }
        }

        return new UserRole
        {
            UserId = userId,
            RoleId = role.RoleId,
            Role = role,
            Status = status,
            AssignedAt = DateTime.UtcNow
        };
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorizedException_WhenUserIsNotAuthenticated()
    {
        // Arrange: No UserId in request, and CurrentUserService returns null
        var query = new GetCurrentUserQuery();
        _currentUserServiceMock.Setup(x => x.UserId).Returns((Guid?)null);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .WithMessage("User is not authenticated.");
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFoundException_WhenUserDoesNotExistInDb()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var query = new GetCurrentUserQuery(userId);
        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("User not found.");
    }

    [Fact]
    public async Task Handle_ShouldReturnCandidateRole_ForAuthenticatedCandidate()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "candidate@example.com", "Nguyen Van Candidate");
        user.UserRoleUsers.Add(CreateUserRole(userId, "CANDIDATE", permissionCodes: new List<string> { "candidate.profile.view", "job.apply" }));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.UserId.Should().Be(userId);
        result.Data.Email.Should().Be("candidate@example.com");
        result.Data.DisplayName.Should().Be("Nguyen Van Candidate");
        result.Data.Status.Should().Be("ACTIVE");
        result.Data.EmailVerified.Should().BeTrue();
        result.Data.Roles.Should().ContainSingle().Which.Should().Be("CANDIDATE");
        result.Data.Permissions.Should().BeEquivalentTo(new[] { "candidate.profile.view", "job.apply" });
    }

    [Fact]
    public async Task Handle_ShouldReturnBothRoles_ForCandidateAndAffiliateUser()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "dual@example.com", "Dual Role User");
        user.UserRoleUsers.Add(CreateUserRole(userId, "CANDIDATE", permissionCodes: new List<string> { "job.apply" }));
        user.UserRoleUsers.Add(CreateUserRole(userId, "AFFILIATE_RECRUITER", permissionCodes: new List<string> { "candidate.submit", "commission.view" }));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert
        result.Data!.Roles.Should().BeEquivalentTo(new[] { "CANDIDATE", "AFFILIATE_RECRUITER" });
        result.Data.Permissions.Should().BeEquivalentTo(new[] { "job.apply", "candidate.submit", "commission.view" });
    }

    [Fact]
    public async Task Handle_ShouldNotReturnAffiliateRole_ForPendingAffiliateBeforeApproval()
    {
        // Arrange: Pending affiliate has no ACTIVE user_role with AFFILIATE_RECRUITER
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "pending_affiliate@example.com", "Pending Affiliate", status: "PENDING", emailVerifiedAt: DateTime.UtcNow);

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert: Roles and permissions are empty before approval
        result.Data!.Roles.Should().BeEmpty();
        result.Data.Permissions.Should().BeEmpty();
        result.Data.Status.Should().Be("PENDING");
    }

    [Fact]
    public async Task Handle_ShouldReturnAffiliateRole_ForApprovedAffiliate()
    {
        // Arrange: Approved affiliate has ACTIVE user_role
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "approved_affiliate@example.com", "Approved Affiliate");
        user.UserRoleUsers.Add(CreateUserRole(userId, "AFFILIATE_RECRUITER", permissionCodes: new List<string> { "affiliate.dashboard.view", "submission.create" }));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert
        result.Data!.Roles.Should().ContainSingle().Which.Should().Be("AFFILIATE_RECRUITER");
        result.Data.Permissions.Should().BeEquivalentTo(new[] { "affiliate.dashboard.view", "submission.create" });
    }

    [Fact]
    public async Task Handle_ShouldNotReturnClientRole_ForPendingClientBeforeApproval()
    {
        // Arrange: Pending client has no CLIENT_COMPANY_USER role yet
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "pending_client@example.com", "Pending Client", status: "PENDING");

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert
        result.Data!.Roles.Should().NotContain("CLIENT_COMPANY_USER");
        result.Data.Roles.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ShouldReturnClientRole_ForApprovedClient()
    {
        // Arrange: Approved client
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "client@example.com", "Client Representative");
        user.UserRoleUsers.Add(CreateUserRole(userId, "CLIENT_COMPANY_USER", permissionCodes: new List<string> { "job.create", "interview.schedule" }));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert
        result.Data!.Roles.Should().ContainSingle().Which.Should().Be("CLIENT_COMPANY_USER");
        result.Data.Permissions.Should().BeEquivalentTo(new[] { "job.create", "interview.schedule" });
    }

    [Fact]
    public async Task Handle_ShouldReturnPlatformAdminAndPermissions_ForAdmin()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "admin@hrconnect.vn", "Platform Admin");
        user.UserRoleUsers.Add(CreateUserRole(userId, "PLATFORM_ADMIN", permissionCodes: new List<string> { "admin.approval.manage", "system.config.view" }));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert
        result.Data!.Roles.Should().ContainSingle().Which.Should().Be("PLATFORM_ADMIN");
        result.Data.Permissions.Should().BeEquivalentTo(new[] { "admin.approval.manage", "system.config.view" });
    }

    [Fact]
    public async Task Handle_ShouldReflectPermissionChangesInDb()
    {
        // Arrange: User with initial role and permissions
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "user@example.com", "User");
        user.UserRoleUsers.Add(CreateUserRole(userId, "PLATFORM_ADMIN", permissionCodes: new List<string> { "perm.a", "perm.b" }));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert: Reflects DB state directly
        result.Data!.Permissions.Should().BeEquivalentTo(new[] { "perm.a", "perm.b" });
    }

    [Fact]
    public async Task Handle_ShouldNeverExposePasswordHashOrTokenData()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "safe@example.com", "Safe User");
        user.UserRoleUsers.Add(CreateUserRole(userId, "CANDIDATE"));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert: CurrentUserDto does NOT have PasswordHash, Otp, or RefreshToken properties
        var properties = typeof(CurrentUserDto).GetProperties();
        properties.Should().NotContain(p => p.Name.Equals("PasswordHash", StringComparison.OrdinalIgnoreCase));
        properties.Should().NotContain(p => p.Name.Equals("Password", StringComparison.OrdinalIgnoreCase));
        properties.Should().NotContain(p => p.Name.Equals("Otp", StringComparison.OrdinalIgnoreCase));
        properties.Should().NotContain(p => p.Name.Equals("RefreshToken", StringComparison.OrdinalIgnoreCase));
        properties.Should().NotContain(p => p.Name.Equals("TokenHash", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Handle_ShouldFallbackToCurrentUserService_WhenRequestUserIdIsNull()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _currentUserServiceMock.Setup(x => x.UserId).Returns(userId);

        var user = CreateUser(userId, "service_user@example.com", "Service User");
        user.UserRoleUsers.Add(CreateUserRole(userId, "CANDIDATE"));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act: request.UserId is null
        var result = await _handler.Handle(new GetCurrentUserQuery(null), CancellationToken.None);

        // Assert
        result.Data!.UserId.Should().Be(userId);
        result.Data.Email.Should().Be("service_user@example.com");
    }

    [Fact]
    public async Task Handle_ShouldIgnoreRevokedOrInactiveRolesAndPermissions()
    {
        // Arrange: User with 1 ACTIVE role and 1 REVOKED/INACTIVE role
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "filtered@example.com", "Filtered User");
        user.UserRoleUsers.Add(CreateUserRole(userId, "CANDIDATE", status: "ACTIVE", isRoleActive: true, permissionCodes: new List<string> { "active.perm" }));
        user.UserRoleUsers.Add(CreateUserRole(userId, "OLD_ROLE", status: "REVOKED", isRoleActive: true, permissionCodes: new List<string> { "revoked.perm" }));
        user.UserRoleUsers.Add(CreateUserRole(userId, "DISABLED_ROLE", status: "ACTIVE", isRoleActive: false, permissionCodes: new List<string> { "disabled.perm" }));

        _userRepositoryMock.Setup(r => r.GetByIdWithRolesAndPermissionsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(new GetCurrentUserQuery(userId), CancellationToken.None);

        // Assert
        result.Data!.Roles.Should().ContainSingle().Which.Should().Be("CANDIDATE");
        result.Data.Permissions.Should().ContainSingle().Which.Should().Be("active.perm");
    }
}
