using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Identity.ResendCandidateIdentityClaimOtp;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace HRConnect.UnitTests.Features.Candidates.Identity;

public sealed class ResendCandidateIdentityClaimOtpCommandHandlerTests
{
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ICandidateIdentityClaimRepository> _claims = new();
    private readonly Mock<IEmailOutboxRepository> _outboxes = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IOtpService> _otp = new();
    private readonly Mock<IEmailService> _email = new();
    private readonly ResendCandidateIdentityClaimOtpCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly CandidateIdentityClaim _claim;

    public ResendCandidateIdentityClaimOtpCommandHandlerTests()
    {
        _claim = new CandidateIdentityClaim
        {
            ClaimId = Guid.NewGuid(),
            RequesterUserId = _userId,
            RequesterCandidateId = Guid.NewGuid(),
            AssertedEmail = "old@example.com",
            NormalizedEmail = "old@example.com",
            TokenHash = "old-hash",
            Status = "PENDING_VERIFICATION",
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            LastSentAt = DateTime.UtcNow.AddMinutes(-2),
            ResendCount = 1,
            ConcurrencyToken = Guid.NewGuid()
        };
        _users.Setup(x => x.GetByIdWithRolesAndPermissionsAsync(
                _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateEligibleUser(_userId));
        _candidates.Setup(x => x.GetByUserIdAsync(_userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate
            {
                CandidateId = _claim.RequesterCandidateId,
                UserId = _userId,
                Status = "ACTIVE"
            });
        _claims.Setup(x => x.GetByIdAsync(_claim.ClaimId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(_claim);
        _claims.Setup(x => x.TryRotateOtpAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(),
                It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _otp.Setup(x => x.GenerateNumericOtp(6)).Returns("654321");
        _otp.Setup(x => x.HashOtp("654321")).Returns("new-hash");
        _email.Setup(x => x.SendEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Success("message-id"));

        _handler = new ResendCandidateIdentityClaimOtpCommandHandler(
            _users.Object,
            _candidates.Object,
            _claims.Object,
            _outboxes.Object,
            _audit.Object,
            _unitOfWork.Object,
            _otp.Object,
            _email.Object,
            Options.Create(new AuthenticationSettings
            {
                Otp = new OtpSettings { Length = 6, ExpirationMinutes = 15 }
            }),
            Mock.Of<ILogger<ResendCandidateIdentityClaimOtpCommandHandler>>());
    }

    [Fact]
    public async Task Handle_RotatesOtpAtomically_AndReturnsNewContract()
    {
        EmailOutbox? capturedOutbox = null;
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((outbox, _) => capturedOutbox = outbox);

        var response = await _handler.Handle(CreateCommand(), CancellationToken.None);

        response.Success.Should().BeTrue();
        response.EmailDeliveryStatus.Should().Be("SENT");
        response.ResendCount.Should().Be(2);
        response.ConcurrencyToken.Should().NotBeEmpty().And.NotBe(_claim.ConcurrencyToken);
        capturedOutbox.Should().NotBeNull();
        capturedOutbox!.Payload.Should().NotContain("654321");
        capturedOutbox.Payload.Should().NotContain("old@example.com");
        capturedOutbox.Status.Should().Be("SENT");
        _claims.Verify(x => x.TryRotateOtpAsync(
            _claim.ClaimId,
            _userId,
            _claim.ConcurrencyToken,
            response.ConcurrencyToken,
            "new-hash",
            It.IsAny<DateTime>(),
            It.IsAny<DateTime>(),
            It.IsAny<DateTime>(),
            5,
            It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(x => x.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.IdentityClaimOtpResent),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_RejectsCooldown_WithoutRotatingOrSending()
    {
        _claim.LastSentAt = DateTime.UtcNow;

        var action = () => _handler.Handle(CreateCommand(), CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_RESEND_COOLDOWN");
        VerifyNoDelivery();
    }

    [Fact]
    public async Task Handle_RejectsExpiredClaim_WithoutRotatingOrSending()
    {
        _claim.ExpiresAt = DateTime.UtcNow.AddSeconds(-1);

        var action = () => _handler.Handle(CreateCommand(), CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_EXPIRED");
        VerifyNoDelivery();
    }

    [Fact]
    public async Task Handle_RejectsResendLimit_WithoutRotatingOrSending()
    {
        _claim.ResendCount = 5;

        var action = () => _handler.Handle(CreateCommand(), CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_RESEND_LIMIT_REACHED");
        VerifyNoDelivery();
    }

    [Fact]
    public async Task Handle_RejectsStaleConcurrencyToken()
    {
        var action = () => _handler.Handle(
            new ResendCandidateIdentityClaimOtpCommand(_userId, _claim.ClaimId, Guid.NewGuid()),
            CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("STALE_IDENTITY_CLAIM");
        VerifyNoDelivery();
    }

    [Fact]
    public async Task Handle_WhenConditionalRotationLosesRace_ReturnsControlledConflict()
    {
        _claims.Setup(x => x.TryRotateOtpAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(),
                It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var action = () => _handler.Handle(CreateCommand(), CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("IDENTITY_CLAIM_CONCURRENT_UPDATE");
        _unitOfWork.Verify(x => x.RollbackTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
        _email.Verify(x => x.SendEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenEmailProviderFails_KeepsAcceptedRequestAndFailedOutbox()
    {
        EmailOutbox? capturedOutbox = null;
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((outbox, _) => capturedOutbox = outbox);
        _email.Setup(x => x.SendEmailAsync(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Failure("provider unavailable"));

        var response = await _handler.Handle(CreateCommand(), CancellationToken.None);

        response.Success.Should().BeTrue();
        response.EmailDeliveryStatus.Should().Be("FAILED");
        capturedOutbox!.Status.Should().Be("FAILED");
        capturedOutbox.LastError.Should().Be("provider unavailable");
    }

    private ResendCandidateIdentityClaimOtpCommand CreateCommand() =>
        new(_userId, _claim.ClaimId, _claim.ConcurrencyToken);

    private void VerifyNoDelivery()
    {
        _claims.Verify(x => x.TryRotateOtpAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(),
            It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
            It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        _email.Verify(x => x.SendEmailAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
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
