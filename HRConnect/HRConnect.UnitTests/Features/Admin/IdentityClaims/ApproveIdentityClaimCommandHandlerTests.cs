using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Admin.IdentityClaims.ApproveIdentityClaim;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Admin.IdentityClaims;

public sealed class ApproveIdentityClaimCommandHandlerTests
{
    private readonly Mock<ICandidateIdentityClaimRepository> _claims = new();
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<IUserEmailIdentityRepository> _identities = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unit = new();
    private readonly Guid _adminUserId = Guid.NewGuid();

    [Fact]
    public async Task Handle_SafeSwap_CompletesClaimAndNotifiesCandidateAtomically()
    {
        var claim = CreateClaim();
        var target = CreateTarget(claim);
        SetupCommon(claim, target);
        _candidates.Setup(x => x.HasIdentityBusinessDataAsync(
                claim.RequesterCandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _candidates.Setup(x => x.TrySwapIdentityCandidateAsync(
                claim.RequesterCandidateId, target.CandidateId, claim.RequesterUserId,
                claim.NormalizedEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _claims.Setup(x => x.TryAdminResolveAsync(
                claim.ClaimId, claim.ConcurrencyToken, It.IsAny<Guid>(), _adminUserId,
                "COMPLETED", It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await CreateHandler().Handle(new ApproveIdentityClaimCommand(
            claim.ClaimId, _adminUserId, claim.ConcurrencyToken, "Đã đối chiếu."),
            CancellationToken.None);

        result.Status.Should().Be("COMPLETED");
        result.CanonicalCandidateId.Should().Be(target.CandidateId);
        result.ConcurrencyToken.Should().NotBeEmpty();
        _notifications.Verify(x => x.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == claim.RequesterUserId &&
            notification.NotificationType == "ACCOUNT" &&
            notification.RelatedEntityId == claim.ClaimId), It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(x => x.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.IdentityClaimReviewed &&
            entry.ActorUserId == _adminUserId), It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RequesterHasBusinessData_LeavesClaimPendingForManualMerge()
    {
        var claim = CreateClaim();
        var target = CreateTarget(claim);
        SetupCommon(claim, target);
        _candidates.Setup(x => x.HasIdentityBusinessDataAsync(
                claim.RequesterCandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var action = () => CreateHandler().Handle(new ApproveIdentityClaimCommand(
            claim.ClaimId, _adminUserId, claim.ConcurrencyToken, null),
            CancellationToken.None);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_MANUAL_MERGE_REQUIRED");
        _candidates.Verify(x => x.TrySwapIdentityCandidateAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _claims.Verify(x => x.TryAdminResolveAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(),
            It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_EmailOwnedByAnotherUser_RejectsWithoutCandidateMutation()
    {
        var claim = CreateClaim();
        var target = CreateTarget(claim);
        SetupCommon(claim, target);
        _identities.Setup(x => x.GetActiveByNormalizedEmailAsync(
                claim.NormalizedEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                NormalizedEmail = claim.NormalizedEmail,
                Email = claim.AssertedEmail,
                Status = "VERIFIED",
                Kind = "ALIAS"
            });

        var action = () => CreateHandler().Handle(new ApproveIdentityClaimCommand(
            claim.ClaimId, _adminUserId, claim.ConcurrencyToken, null),
            CancellationToken.None);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_EMAIL_OWNERSHIP_CHANGED");
        _candidates.Verify(x => x.TrySwapIdentityCandidateAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Never);
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReviewerPermissionRevoked_ReturnsForbidden()
    {
        var claim = CreateClaim();
        _claims.Setup(x => x.GetByIdAsync(claim.ClaimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(claim);
        _users.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(
                _adminUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser { UserId = _adminUserId, Status = "ACTIVE" });

        var action = () => CreateHandler().Handle(new ApproveIdentityClaimCommand(
            claim.ClaimId, _adminUserId, claim.ConcurrencyToken, null),
            CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*thu hồi quyền*");
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ClaimChangedAfterSafeSwap_RollsBackWholeTransaction()
    {
        var claim = CreateClaim();
        var target = CreateTarget(claim);
        SetupCommon(claim, target);
        _candidates.Setup(x => x.HasIdentityBusinessDataAsync(
                claim.RequesterCandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _candidates.Setup(x => x.TrySwapIdentityCandidateAsync(
                claim.RequesterCandidateId, target.CandidateId, claim.RequesterUserId,
                claim.NormalizedEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _claims.Setup(x => x.TryAdminResolveAsync(
                claim.ClaimId, claim.ConcurrencyToken, It.IsAny<Guid>(), _adminUserId,
                "COMPLETED", It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var action = () => CreateHandler().Handle(new ApproveIdentityClaimCommand(
            claim.ClaimId, _adminUserId, claim.ConcurrencyToken, null), CancellationToken.None);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_CONCURRENT_REVIEW");
        _unit.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
        _notifications.Verify(x => x.AddAsync(
            It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private void SetupCommon(CandidateIdentityClaim claim, Candidate target)
    {
        _claims.Setup(x => x.GetByIdAsync(claim.ClaimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(claim);
        _users.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(
                _adminUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateAdmin(_adminUserId));
        _users.Setup(x => x.GetByIdAsync(claim.RequesterUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser { UserId = claim.RequesterUserId, Status = "ACTIVE" });
        _candidates.Setup(x => x.GetByIdAsync(claim.RequesterCandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = claim.RequesterCandidateId,
                UserId = claim.RequesterUserId,
                Status = "ACTIVE"
            });
        _candidates.Setup(x => x.GetByIdAsync(target.CandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(target);
        _identities.Setup(x => x.GetActiveByNormalizedEmailAsync(
                claim.NormalizedEmail, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = claim.RequesterUserId,
                NormalizedEmail = claim.NormalizedEmail,
                Email = claim.AssertedEmail,
                Status = "VERIFIED",
                Kind = "ALIAS"
            });
    }

    private ApproveIdentityClaimCommandHandler CreateHandler() => new(
        _claims.Object,
        _candidates.Object,
        _identities.Object,
        _users.Object,
        _notifications.Object,
        _audit.Object,
        _unit.Object);

    private static CandidateIdentityClaim CreateClaim()
    {
        var requesterCandidateId = Guid.NewGuid();
        return new CandidateIdentityClaim
        {
            ClaimId = Guid.NewGuid(),
            RequesterUserId = Guid.NewGuid(),
            RequesterCandidateId = requesterCandidateId,
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
    }

    private static Candidate CreateTarget(CandidateIdentityClaim claim) => new()
    {
        CandidateId = claim.TargetCandidateId!.Value,
        UserId = null,
        FullName = "Candidate cũ",
        Email = claim.AssertedEmail,
        NormalizedEmail = claim.NormalizedEmail,
        Status = "ACTIVE"
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
