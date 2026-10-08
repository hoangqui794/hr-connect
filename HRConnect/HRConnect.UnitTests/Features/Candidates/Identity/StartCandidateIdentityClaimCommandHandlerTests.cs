using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Identity.StartCandidateIdentityClaim;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Candidates.Identity;

public sealed class StartCandidateIdentityClaimCommandHandlerTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<IUserEmailIdentityRepository> _identities = new();
    private readonly Mock<ICandidateIdentityClaimRepository> _claims = new();
    private readonly Mock<IEmailOutboxRepository> _outboxes = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IEmailNormalizer> _normalizer = new();
    private readonly Mock<IOtpService> _otp = new();
    private readonly Mock<IEmailService> _email = new();
    private readonly StartCandidateIdentityClaimCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Candidate _requesterCandidate;

    public StartCandidateIdentityClaimCommandHandlerTests()
    {
        _requesterCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = _userId,
            Status = "ACTIVE"
        };
        _users.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(
                _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleUser(_userId));
        _candidates.Setup(x => x.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(_requesterCandidate);
        _normalizer.Setup(x => x.Normalize(It.IsAny<string>()))
            .Returns((string email) => email.Trim().ToLowerInvariant());
        _otp.Setup(x => x.GenerateNumericOtp(6)).Returns("123456");
        _otp.Setup(x => x.HashOtp("123456")).Returns("otp-hash");
        _email.Setup(x => x.SendEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Success("message-id"));

        _handler = new StartCandidateIdentityClaimCommandHandler(
            _users.Object,
            _candidates.Object,
            _identities.Object,
            _claims.Object,
            _outboxes.Object,
            _audit.Object,
            _unitOfWork.Object,
            _normalizer.Object,
            _otp.Object,
            _email.Object,
            Options.Create(new AuthenticationSettings
            {
                Otp = new OtpSettings { Length = 6, ExpirationMinutes = 15 }
            }),
            Mock.Of<ILogger<StartCandidateIdentityClaimCommandHandler>>());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Handle_ReturnsSameAcceptedContract_RegardlessOfExistingTargetCandidate(
        bool targetExists)
    {
        var target = targetExists
            ? new Candidate
            {
                CandidateId = Guid.NewGuid(),
                Email = "old@example.com",
                NormalizedEmail = "old@example.com",
                Status = "ACTIVE"
            }
            : null;
        _candidates.Setup(x => x.GetByNormalizedEmailAsync(
                "old@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(target);
        CandidateIdentityClaim? capturedClaim = null;
        EmailOutbox? capturedOutbox = null;
        _claims.Setup(x => x.AddAsync(It.IsAny<CandidateIdentityClaim>(), It.IsAny<CancellationToken>()))
            .Callback<CandidateIdentityClaim, CancellationToken>((claim, _) => capturedClaim = claim);
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((outbox, _) => capturedOutbox = outbox);

        var response = await _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "Old@Example.com"),
            CancellationToken.None);

        response.Success.Should().BeTrue();
        response.Message.Should().Be(
            "Nếu email hợp lệ, HR Connect đã gửi mã xác minh. Vui lòng kiểm tra hộp thư.");
        response.Data.MaskedDestination.Should().Be("ol***@example.com");
        capturedClaim.Should().NotBeNull();
        response.Data.ConcurrencyToken.Should().Be(capturedClaim!.ConcurrencyToken);
        capturedClaim.Status.Should().Be("PENDING_VERIFICATION");
        capturedClaim.TargetCandidateId.Should().Be(target?.CandidateId);
        capturedClaim.TokenHash.Should().Be("otp-hash");
        capturedOutbox.Should().NotBeNull();
        capturedOutbox!.Payload.Should().NotContain("123456");
        capturedOutbox.Payload.Should().NotContain("old@example.com");
        capturedOutbox.Status.Should().Be("SENT");
        _audit.Verify(x => x.AddAsync(
            It.Is<AuditEntry>(entry =>
                entry.Action == AuditActions.IdentityClaimRequested &&
                entry.ActorUserId == _userId &&
                entry.EntityId == capturedClaim.ClaimId),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_SuppressesDelivery_WhenEmailBelongsToAnotherAccount()
    {
        _identities.Setup(x => x.GetActiveByNormalizedEmailAsync(
                "owned@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = Guid.NewGuid(),
                Email = "owned@example.com",
                NormalizedEmail = "owned@example.com",
                Kind = "PRIMARY",
                Status = "VERIFIED",
                VerificationSource = "REGISTRATION"
            });
        CandidateIdentityClaim? capturedClaim = null;
        _claims.Setup(x => x.AddAsync(It.IsAny<CandidateIdentityClaim>(), It.IsAny<CancellationToken>()))
            .Callback<CandidateIdentityClaim, CancellationToken>((claim, _) => capturedClaim = claim);

        var response = await _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "owned@example.com"),
            CancellationToken.None);

        response.Success.Should().BeTrue();
        capturedClaim!.Status.Should().Be("CANCELLED");
        capturedClaim.ReviewReason.Should().Be("EMAIL_OWNED_BY_ANOTHER_ACCOUNT");
        _outboxes.Verify(x => x.AddAsync(
            It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()), Times.Never);
        _email.Verify(x => x.SendEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RejectsEmailAlreadyLinkedToSameAccount()
    {
        _identities.Setup(x => x.GetActiveByNormalizedEmailAsync(
                "alias@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserEmailIdentity
            {
                EmailIdentityId = Guid.NewGuid(),
                UserId = _userId,
                Email = "alias@example.com",
                NormalizedEmail = "alias@example.com",
                Kind = "ALIAS",
                Status = "VERIFIED",
                VerificationSource = "CANDIDATE_CLAIM"
            });

        var action = () => _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "alias@example.com"),
            CancellationToken.None);

        var error = await action.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be("EMAIL_IDENTITY_ALREADY_LINKED");
        _claims.Verify(x => x.AddAsync(
            It.IsAny<CandidateIdentityClaim>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ReturnsExistingActiveClaim_WithoutSendingAnotherOtp()
    {
        var existing = new CandidateIdentityClaim
        {
            ClaimId = Guid.NewGuid(),
            RequesterUserId = _userId,
            RequesterCandidateId = _requesterCandidate.CandidateId,
            AssertedEmail = "old@example.com",
            NormalizedEmail = "old@example.com",
            TokenHash = "existing-hash",
            Status = "PENDING_VERIFICATION",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            LastSentAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _claims.Setup(x => x.GetActiveByRequesterAndEmailAsync(
                _userId, "old@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var response = await _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "old@example.com"),
            CancellationToken.None);

        response.Data.ClaimId.Should().Be(existing.ClaimId);
        _claims.Verify(x => x.AddAsync(
            It.IsAny<CandidateIdentityClaim>(), It.IsAny<CancellationToken>()), Times.Never);
        _email.Verify(x => x.SendEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ExpiresOldPendingClaim_AndCreatesFreshRequest()
    {
        var expired = new CandidateIdentityClaim
        {
            ClaimId = Guid.NewGuid(),
            RequesterUserId = _userId,
            RequesterCandidateId = _requesterCandidate.CandidateId,
            AssertedEmail = "old@example.com",
            NormalizedEmail = "old@example.com",
            TokenHash = "expired-hash",
            Status = "PENDING_VERIFICATION",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1),
            CreatedAt = DateTime.UtcNow.AddMinutes(-20),
            UpdatedAt = DateTime.UtcNow.AddMinutes(-20)
        };
        _claims.Setup(x => x.GetActiveByRequesterAndEmailAsync(
                _userId, "old@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expired);

        var response = await _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "old@example.com"),
            CancellationToken.None);

        response.Data.ClaimId.Should().NotBe(expired.ClaimId);
        expired.Status.Should().Be("EXPIRED");
        expired.CompletedAt.Should().NotBeNull();
        _claims.Verify(x => x.Update(expired), Times.Once);
        _claims.Verify(x => x.AddAsync(
            It.Is<CandidateIdentityClaim>(claim => claim.Status == "PENDING_VERIFICATION"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReturnsConcurrentWinner_WhenUniqueInsertLosesRace()
    {
        var winner = new CandidateIdentityClaim
        {
            ClaimId = Guid.NewGuid(),
            RequesterUserId = _userId,
            RequesterCandidateId = _requesterCandidate.CandidateId,
            AssertedEmail = "old@example.com",
            NormalizedEmail = "old@example.com",
            TokenHash = "winner-hash",
            Status = "PENDING_VERIFICATION",
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            LastSentAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _claims.SetupSequence(x => x.GetActiveByRequesterAndEmailAsync(
                _userId, "old@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateIdentityClaim?)null)
            .ReturnsAsync(winner);
        _unitOfWork.Setup(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("unique constraint"));

        var response = await _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "old@example.com"),
            CancellationToken.None);

        response.Data.ClaimId.Should().Be(winner.ClaimId);
        _unitOfWork.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _email.Verify(x => x.SendEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RemainsAccepted_WhenEmailProviderThrows()
    {
        EmailOutbox? outbox = null;
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((value, _) => outbox = value);
        _email.Setup(x => x.SendEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("provider unavailable"));

        var response = await _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "old@example.com"),
            CancellationToken.None);

        response.Success.Should().BeTrue();
        outbox!.Status.Should().Be("FAILED");
        outbox.LastError.Should().Contain("provider unavailable");
    }

    [Fact]
    public async Task Handle_RejectsAccountWithoutActiveCandidatePermission()
    {
        _users.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(
                _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AppUser
            {
                UserId = _userId,
                Email = "candidate@example.com",
                Status = "ACTIVE"
            });

        var action = () => _handler.Handle(
            new StartCandidateIdentityClaimCommand(_userId, "old@example.com"),
            CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        _candidates.Verify(x => x.GetByUserIdAsync(
            It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static AppUser CreateEligibleUser(Guid userId)
    {
        var permission = new Permission
        {
            PermissionId = Guid.NewGuid(),
            Code = "candidate.identity.manage_own",
            Resource = "candidate_identity",
            Action = "manage_own",
            IsActive = true
        };
        var role = new Role
        {
            RoleId = Guid.NewGuid(),
            Code = "CANDIDATE",
            Name = "Candidate",
            IsActive = true
        };
        role.RolePermissions.Add(new RolePermission
        {
            RoleId = role.RoleId,
            PermissionId = permission.PermissionId,
            Role = role,
            Permission = permission
        });
        var user = new AppUser
        {
            UserId = userId,
            Email = "candidate@example.com",
            DisplayName = "Candidate Test",
            Status = "ACTIVE"
        };
        user.UserRoleUsers.Add(new UserRole
        {
            UserId = userId,
            RoleId = role.RoleId,
            Role = role,
            User = user,
            Status = "ACTIVE",
            AssignmentSource = "REGISTRATION"
        });
        return user;
    }
}
