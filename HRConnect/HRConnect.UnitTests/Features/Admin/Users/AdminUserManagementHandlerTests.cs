using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Admin.Users.Commands.ChangeUserStatus;
using HRConnect.Application.Features.Admin.Users.Commands.UnlockUser;
using HRConnect.Application.Features.Admin.Users.Queries.GetAdminUserDetail;
using HRConnect.Application.Features.Admin.Users.Queries.GetAdminUsers;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.Users;

public class AdminUserManagementHandlerTests
{
    [Fact]
    public async Task ChangeStatusValidator_WhenStatusIsNull_ReturnsValidationError()
    {
        var validator = new ChangeUserStatusCommandValidator();
        var command = new ChangeUserStatusCommand(Guid.NewGuid(), Guid.NewGuid(), null!, null);

        var result = await validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.PropertyName == nameof(ChangeUserStatusCommand.Status));
    }

    [Fact]
    public async Task GetUsers_MapsPaginationAndActiveRoles()
    {
        var user = CreateUser("ACTIVE", "CANDIDATE");
        var repository = new Mock<IAdminUserRepository>();
        repository.Setup(item => item.GetUsersAsync(
                "linh", "ACTIVE", "CANDIDATE", 2, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<AppUser> { user }, 21));
        var handler = new GetAdminUsersQueryHandler(repository.Object);

        var result = await handler.Handle(
            new GetAdminUsersQuery(" linh ", "active", "candidate", 2, 10),
            CancellationToken.None);

        result.Data.Total.Should().Be(21);
        result.Data.TotalPages.Should().Be(3);
        result.Data.Items.Should().ContainSingle();
        result.Data.Items[0].Roles.Should().Equal("CANDIDATE");
        result.Data.Items[0].Should().NotBeEquivalentTo(new { PasswordHash = "hash" });
    }

    [Fact]
    public async Task GetUsers_RejectsInvalidStatus()
    {
        var handler = new GetAdminUsersQueryHandler(new Mock<IAdminUserRepository>().Object);

        var action = () => handler.Handle(
            new GetAdminUsersQuery(Status: "UNKNOWN_STATUS"),
            CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task GetDetail_WhenMissing_ThrowsNotFound()
    {
        var userId = Guid.NewGuid();
        var repository = new Mock<IAdminUserRepository>();
        repository.Setup(item => item.GetByIdWithRolesAsync(
                userId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AppUser?)null);
        var handler = new GetAdminUserDetailQueryHandler(repository.Object);

        var action = () => handler.Handle(new GetAdminUserDetailQuery(userId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task ChangeStatus_ActiveToSuspended_RevokesTokensAndAuditsAtomically()
    {
        var actorId = Guid.NewGuid();
        var user = CreateUser("ACTIVE", "CANDIDATE");
        var repository = new Mock<IAdminUserRepository>();
        repository.Setup(item => item.GetByIdWithRolesAsync(
                user.UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        var refreshTokens = new Mock<IRefreshTokenRepository>();
        var audit = new Mock<IAuditLogService>();
        AuditEntry? capturedAudit = null;
        audit.Setup(item => item.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
            .Callback<AuditEntry, CancellationToken>((entry, _) => capturedAudit = entry)
            .Returns(Task.CompletedTask);
        var unitOfWork = new Mock<IUnitOfWork>();
        var handler = new ChangeUserStatusCommandHandler(
            repository.Object, refreshTokens.Object, audit.Object, unitOfWork.Object);

        var result = await handler.Handle(
            new ChangeUserStatusCommand(user.UserId, actorId, "SUSPENDED", "Vi phạm chính sách"),
            CancellationToken.None);

        user.Status.Should().Be("SUSPENDED");
        result.Data.Status.Should().Be("SUSPENDED");
        refreshTokens.Verify(item => item.RevokeAllByUserIdAsync(
            user.UserId, "USER_SUSPENDED", It.IsAny<CancellationToken>()), Times.Once);
        capturedAudit.Should().NotBeNull();
        capturedAudit!.Action.Should().Be(AuditActions.UserSuspended);
        capturedAudit.ActorUserId.Should().Be(actorId);
        unitOfWork.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ChangeStatus_WhenTargetIsPlatformAdmin_IsForbidden()
    {
        var user = CreateUser("ACTIVE", "PLATFORM_ADMIN");
        var repository = new Mock<IAdminUserRepository>();
        repository.Setup(item => item.GetByIdWithRolesAsync(
                user.UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        var unitOfWork = new Mock<IUnitOfWork>();
        var handler = new ChangeUserStatusCommandHandler(
            repository.Object,
            new Mock<IRefreshTokenRepository>().Object,
            new Mock<IAuditLogService>().Object,
            unitOfWork.Object);

        var action = () => handler.Handle(
            new ChangeUserStatusCommand(user.UserId, Guid.NewGuid(), "SUSPENDED", "reason"),
            CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        unitOfWork.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ChangeStatus_DoesNotActivatePendingUser()
    {
        var user = CreateUser("PENDING", "CANDIDATE");
        var repository = new Mock<IAdminUserRepository>();
        repository.Setup(item => item.GetByIdWithRolesAsync(
                user.UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        var handler = new ChangeUserStatusCommandHandler(
            repository.Object,
            new Mock<IRefreshTokenRepository>().Object,
            new Mock<IAuditLogService>().Object,
            new Mock<IUnitOfWork>().Object);

        var action = () => handler.Handle(
            new ChangeUserStatusCommand(user.UserId, Guid.NewGuid(), "ACTIVE", null),
            CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Unlock_ClearsLoginLockoutButKeepsBusinessStatus()
    {
        var actorId = Guid.NewGuid();
        var user = CreateUser("SUSPENDED", "CANDIDATE");
        user.LockoutEndAt = DateTime.UtcNow.AddHours(1);
        user.FailedLoginAttempts = 5;
        var repository = new Mock<IAdminUserRepository>();
        repository.Setup(item => item.GetByIdWithRolesAsync(
                user.UserId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        var audit = new Mock<IAuditLogService>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var handler = new UnlockUserCommandHandler(repository.Object, audit.Object, unitOfWork.Object);

        var result = await handler.Handle(
            new UnlockUserCommand(user.UserId, actorId),
            CancellationToken.None);

        user.Status.Should().Be("SUSPENDED");
        user.LockoutEndAt.Should().BeNull();
        user.FailedLoginAttempts.Should().Be(0);
        result.Data.Status.Should().Be("SUSPENDED");
        audit.Verify(item => item.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.UserLoginUnlocked && entry.ActorUserId == actorId),
            It.IsAny<CancellationToken>()), Times.Once);
        unitOfWork.Verify(item => item.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private static AppUser CreateUser(string status, string roleCode)
    {
        var user = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "user@example.com",
            PasswordHash = "hash",
            Status = status,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        };
        user.UserRoleUsers.Add(new UserRole
        {
            Status = "ACTIVE",
            Role = new Role { Code = roleCode, IsActive = true }
        });
        return user;
    }
}
