using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Admin.IdentityClaims.RejectIdentityClaim;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.IdentityClaims;

public sealed class RejectIdentityClaimCommandHandlerTests
{
    private readonly Mock<ICandidateIdentityClaimRepository> _claims = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unit = new();
    private readonly Guid _adminUserId = Guid.NewGuid();

    [Fact]
    public async Task Handle_ValidRequest_RejectsAndNotifiesWithoutChangingCandidateData()
    {
        var claim = CreateClaim();
        SetupReviewer(claim);
        _claims.Setup(x => x.TryAdminResolveAsync(
                claim.ClaimId, claim.ConcurrencyToken, It.IsAny<Guid>(), _adminUserId,
                "REJECTED", It.IsAny<DateTime>(), "Không đủ bằng chứng.",
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var response = await CreateHandler().Handle(new RejectIdentityClaimCommand(
            claim.ClaimId, _adminUserId, claim.ConcurrencyToken, "  Không đủ bằng chứng.  "),
            CancellationToken.None);

        response.Status.Should().Be("REJECTED");
        response.ConcurrencyToken.Should().NotBeEmpty();
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == claim.RequesterUserId &&
            notification.NotificationType == "ACCOUNT" &&
            notification.RelatedEntityId == claim.ClaimId &&
            notification.Message.Contains("Không đủ bằng chứng.")),
            It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(x => x.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.IdentityClaimReviewed &&
            entry.ActorUserId == _adminUserId), It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_StaleConcurrencyToken_RejectsBeforeMutation()
    {
        var claim = CreateClaim();
        _claims.Setup(x => x.GetByIdAsync(claim.ClaimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(claim);

        var action = () => CreateHandler().Handle(new RejectIdentityClaimCommand(
            claim.ClaimId, _adminUserId, Guid.NewGuid(), "Từ chối."), CancellationToken.None);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("STALE_IDENTITY_CLAIM");
        _claims.Verify(x => x.TryAdminResolveAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(),
            It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ConcurrentAdminWon_RollsBackAndDoesNotNotify()
    {
        var claim = CreateClaim();
        SetupReviewer(claim);
        _claims.Setup(x => x.TryAdminResolveAsync(
                claim.ClaimId, claim.ConcurrencyToken, It.IsAny<Guid>(), _adminUserId,
                "REJECTED", It.IsAny<DateTime>(), It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var action = () => CreateHandler().Handle(new RejectIdentityClaimCommand(
            claim.ClaimId, _adminUserId, claim.ConcurrencyToken, "Từ chối."),
            CancellationToken.None);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_CONCURRENT_REVIEW");
        _notifications.Verify(x => x.AddAsync(
            It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Never);
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void Validator_RequiresReasonAndConcurrencyToken()
    {
        var validator = new RejectIdentityClaimCommandValidator();
        var result = validator.Validate(new RejectIdentityClaimCommand(
            Guid.NewGuid(), _adminUserId, Guid.Empty, " "));

        result.IsValid.Should().BeFalse();
        result.Errors.Select(error => error.PropertyName)
            .Should().Contain(["ConcurrencyToken", "Reason"]);
    }

    private void SetupReviewer(CandidateIdentityClaim claim)
    {
        _claims.Setup(x => x.GetByIdAsync(claim.ClaimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(claim);
        _users.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(
                _adminUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateAdmin(_adminUserId));
    }

    private RejectIdentityClaimCommandHandler CreateHandler() => new(
        _claims.Object,
        _users.Object,
        _notifications.Object,
        _audit.Object,
        _unit.Object);

    private static CandidateIdentityClaim CreateClaim() => new()
    {
        ClaimId = Guid.NewGuid(),
        RequesterUserId = Guid.NewGuid(),
        RequesterCandidateId = Guid.NewGuid(),
        TargetCandidateId = Guid.NewGuid(),
        AssertedEmail = "old@example.com",
        NormalizedEmail = "old@example.com",
        TokenHash = "hash",
        Status = "PENDING_ADMIN_REVIEW",
        ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
        VerifiedAt = DateTime.UtcNow.AddMinutes(-2),
        ReviewReason = "CANDIDATE_SWAP_REQUIRES_ADMIN_REVIEW",
        CreatedAt = DateTime.UtcNow.AddMinutes(-5),
        UpdatedAt = DateTime.UtcNow.AddMinutes(-2),
        ConcurrencyToken = Guid.NewGuid()
    };

    private static AppUser CreateAdmin(Guid userId)
    {
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "PLATFORM_ADMIN",
            Name = "Platform Admin",
            IsActive = true
        };
        var user = new AppUser { UserId = userId, Status = "ACTIVE" };
        user.UserRoleUsers.Add(new UserRole
        {
            UserId = userId,
            RoleId = role.RoleId,
            Status = "ACTIVE",
            Role = role,
            User = user,
            AssignmentSource = "TEST"
        });
        return user;
    }
}
