using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateAffiliateCvReuse;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class UpdateCandidateAffiliateCvReuseCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidates = new();
    private readonly Mock<ICandidateCvRepository> _candidateCvs = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    [Fact]
    public async Task Handle_WhenEligibleAndAllowed_GrantsReuseRotatesTokenAndAudits()
    {
        var fixture = Setup("NOT_GRANTED", acceptedSubmissionCount: 1);

        var response = await Handler().Handle(
            new UpdateCandidateAffiliateCvReuseCommand(
                fixture.UserId, fixture.Cv.CvId, true, fixture.OriginalToken),
            CancellationToken.None);

        fixture.Cv.AffiliateReuseStatus.Should().Be("ALLOWED");
        fixture.Cv.AffiliateReuseConcurrencyToken.Should().NotBe(fixture.OriginalToken);
        response.Data.AffiliateReuseStatus.Should().Be("ALLOWED");
        _audit.Verify(service => service.AddAsync(
            It.Is<AuditEntry>(entry =>
                entry.Action == AuditActions.AffiliateCvReuseGranted &&
                entry.EntityId == fixture.Cv.CvId &&
                entry.ActorUserId == fixture.UserId),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenAllowedIsRevoked_RevokesOnlyFutureReuse()
    {
        var fixture = Setup("ALLOWED", acceptedSubmissionCount: 2);

        var response = await Handler().Handle(
            new UpdateCandidateAffiliateCvReuseCommand(
                fixture.UserId, fixture.Cv.CvId, false, fixture.OriginalToken),
            CancellationToken.None);

        response.Data.AffiliateReuseStatus.Should().Be("REVOKED");
        _audit.Verify(service => service.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.AffiliateCvReuseRevoked),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenTokenIsStale_ThrowsConcurrentUpdateWithoutSaving()
    {
        var fixture = Setup("NOT_GRANTED", acceptedSubmissionCount: 1);

        var action = () => Handler().Handle(
            new UpdateCandidateAffiliateCvReuseCommand(
                fixture.UserId, fixture.Cv.CvId, true, Guid.NewGuid()),
            CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("CONCURRENT_UPDATE");
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenNoSubmissionWasConfirmed_CannotGrantReuse()
    {
        var fixture = Setup("NOT_GRANTED", acceptedSubmissionCount: 0);

        var action = () => Handler().Handle(
            new UpdateCandidateAffiliateCvReuseCommand(
                fixture.UserId, fixture.Cv.CvId, true, fixture.OriginalToken),
            CancellationToken.None);

        var exception = await action.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("CV_REUSE_NOT_ELIGIBLE");
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("ALLOWED", true)]
    [InlineData("NOT_GRANTED", false)]
    [InlineData("REVOKED", false)]
    public async Task Handle_WhenRequestedStateAlreadyApplied_IsIdempotent(
        string currentStatus,
        bool allowed)
    {
        var fixture = Setup(currentStatus, acceptedSubmissionCount: 1);

        var response = await Handler().Handle(
            new UpdateCandidateAffiliateCvReuseCommand(
                fixture.UserId, fixture.Cv.CvId, allowed, fixture.OriginalToken),
            CancellationToken.None);

        response.Data.ReuseConcurrencyToken.Should().Be(fixture.OriginalToken);
        _audit.Verify(service => service.AddAsync(
            It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    private Fixture Setup(string reuseStatus, int acceptedSubmissionCount)
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var token = Guid.NewGuid();
        var cv = new CandidateCv
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidateId,
            CreationMethod = "AFFILIATE_UPLOAD",
            Status = acceptedSubmissionCount > 0 ? "ACTIVE" : "PENDING_CONSENT",
            AffiliateReuseStatus = reuseStatus,
            AffiliateReuseConcurrencyToken = token,
            UpdatedAt = DateTime.UtcNow
        };
        _candidates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId, Status = "ACTIVE" });
        _candidateCvs.Setup(repository => repository.GetByCandidateIdAndCvIdAsync(
                candidateId, cv.CvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);
        _submissions.Setup(repository => repository.GetCandidateAffiliateCvDetailAsync(
                candidateId, cv.CvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CandidateAffiliateCvDetailRecord(
                cv.CvId, "CV", "cv.pdf", "application/pdf", 100, cv.Status, reuseStatus,
                token, null, affiliateId, "Affiliate", 1, acceptedSubmissionCount == 0 ? 1 : 0,
                acceptedSubmissionCount, 0, 0, DateTime.UtcNow, DateTime.UtcNow, DateTime.UtcNow));
        return new Fixture(userId, token, cv);
    }

    private UpdateCandidateAffiliateCvReuseCommandHandler Handler() => new(
        _candidates.Object,
        _candidateCvs.Object,
        _submissions.Object,
        _audit.Object,
        _unitOfWork.Object);

    private sealed record Fixture(Guid UserId, Guid OriginalToken, CandidateCv Cv);
}
