using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Identity.VerifyCandidateIdentityClaim;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.Candidates.Identity;

public sealed class VerifyCandidateIdentityClaimCommandHandlerTests
{
    private readonly Mock<ICandidateIdentityClaimRepository> _claims = new();
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<IUserEmailIdentityRepository> _identities = new();
    private readonly Mock<IOtpService> _otp = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unit = new();

    [Fact]
    public async Task Handle_VerifiesAliasAndCompletes_WhenNoOldCandidateExists()
    {
        var claim = CreateClaim();
        SetupClaim(claim, otpValid: true);
        UserEmailIdentity? alias = null;
        _identities.Setup(x => x.AddAsync(It.IsAny<UserEmailIdentity>(), It.IsAny<CancellationToken>()))
            .Callback<UserEmailIdentity, CancellationToken>((value, _) => alias = value);
        var handler = CreateHandler();

        var result = await handler.Handle(new VerifyCandidateIdentityClaimCommand(
            claim.RequesterUserId, claim.ClaimId, "123456", claim.ConcurrencyToken), CancellationToken.None);

        result.Status.Should().Be("COMPLETED");
        alias!.Kind.Should().Be("ALIAS");
        alias.Status.Should().Be("VERIFIED");
        _unit.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_RoutesToAdminReview_WhenPlaceholderHasBusinessData()
    {
        var claim = CreateClaim();
        claim.TargetCandidateId = Guid.NewGuid();
        SetupClaim(claim, otpValid: true);
        _candidates.Setup(x => x.GetByIdAsync(claim.TargetCandidateId.Value, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = claim.TargetCandidateId.Value, Status = "ACTIVE", NormalizedEmail = claim.NormalizedEmail });
        _candidates.Setup(x => x.HasIdentityBusinessDataAsync(claim.RequesterCandidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        string? completedStatus = null;
        _claims.Setup(x => x.TryCompleteAsync(claim.ClaimId, claim.RequesterUserId, It.IsAny<Guid>(),
                It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, Guid, Guid, string, Guid, DateTime, string?, CancellationToken>((_, _, _, status, _, _, _, _) => completedStatus = status)
            .ReturnsAsync(true);

        var result = await CreateHandler().Handle(new VerifyCandidateIdentityClaimCommand(
            claim.RequesterUserId, claim.ClaimId, "123456", claim.ConcurrencyToken), CancellationToken.None);

        result.Status.Should().Be("PENDING_ADMIN_REVIEW");
        completedStatus.Should().Be("PENDING_ADMIN_REVIEW");
        _candidates.Verify(x => x.TrySwapIdentityCandidateAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RecordsFailedAttempt_WithoutStartingTransaction()
    {
        var claim = CreateClaim();
        SetupClaim(claim, otpValid: false);

        var action = () => CreateHandler().Handle(new VerifyCandidateIdentityClaimCommand(
            claim.RequesterUserId, claim.ClaimId, "000000", claim.ConcurrencyToken), CancellationToken.None);

        await action.Should().ThrowAsync<BadRequestException>().WithMessage("*không chính xác*");
        _claims.Verify(x => x.TryRecordFailedAttemptAsync(
            claim.ClaimId, claim.RequesterUserId, claim.ConcurrencyToken, It.IsAny<Guid>(), false,
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
        _unit.Verify(x => x.BeginTransactionAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private void SetupClaim(CandidateIdentityClaim claim, bool otpValid)
    {
        _claims.Setup(x => x.GetByIdAsync(claim.ClaimId, It.IsAny<CancellationToken>())).ReturnsAsync(claim);
        _otp.Setup(x => x.VerifyOtp(It.IsAny<string>(), claim.TokenHash)).Returns(otpValid);
        _claims.Setup(x => x.TryMarkVerifiedAsync(claim.ClaimId, claim.RequesterUserId, claim.ConcurrencyToken,
            It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _claims.Setup(x => x.TryRecordFailedAttemptAsync(claim.ClaimId, claim.RequesterUserId, claim.ConcurrencyToken,
            It.IsAny<Guid>(), It.IsAny<bool>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _claims.Setup(x => x.TryCompleteAsync(claim.ClaimId, claim.RequesterUserId, It.IsAny<Guid>(),
            It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<string?>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
    }

    private VerifyCandidateIdentityClaimCommandHandler CreateHandler() => new(
        _claims.Object, _candidates.Object, _identities.Object, _otp.Object, _audit.Object, _unit.Object);

    private static CandidateIdentityClaim CreateClaim() => new()
    {
        ClaimId = Guid.NewGuid(), RequesterUserId = Guid.NewGuid(), RequesterCandidateId = Guid.NewGuid(),
        AssertedEmail = "old@example.com", NormalizedEmail = "old@example.com", TokenHash = "hash",
        Status = "PENDING_VERIFICATION", ExpiresAt = DateTime.UtcNow.AddMinutes(10),
        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, ConcurrencyToken = Guid.NewGuid()
    };
}
