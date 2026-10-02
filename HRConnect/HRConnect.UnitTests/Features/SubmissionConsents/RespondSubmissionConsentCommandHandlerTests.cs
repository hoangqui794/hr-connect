using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.SubmissionConsents.RespondSubmissionConsent;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.SubmissionConsents;

public sealed class RespondSubmissionConsentCommandHandlerTests
{
    private readonly Mock<ISubmissionConsentRepository> _consents = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();
    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<IAffiliateProfileRepository> _affiliates = new();
    private readonly Mock<IAttributionRepository> _attributions = new();
    private readonly Mock<ICandidateCvRepository> _cvs = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IMf03ScoringTrigger> _scoring = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    [Fact]
    public async Task Confirm_CreatesApplicationAttributionAndMf03Work()
    {
        var fixture = CreateConsent();
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);
        _submissions.Setup(x => x.GetAcceptedSubmissionAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync((Submission?)null);
        _applications.Setup(x => x.GetByCandidateAndJobAsync(fixture.Candidate.CandidateId, fixture.Job.JobId, It.IsAny<CancellationToken>())).ReturnsAsync((JobApplication?)null);
        _affiliates.Setup(x => x.GetByUserIdAsync(fixture.Submission.SubmittedBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = fixture.Submission.SubmittedBy, Status = "ACTIVE" });

        JobApplication? created = null;
        _applications.Setup(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()))
            .Callback<JobApplication, CancellationToken>((value, _) => created = value)
            .Returns(Task.CompletedTask);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = fixture.Candidate.UserId
        }, CancellationToken.None);

        response.SubmissionStatus.Should().Be("ACCEPTED");
        response.ApplicationId.Should().Be(created!.ApplicationId);
        fixture.Consent.Status.Should().Be("CONFIRMED");
        fixture.Cv.Status.Should().Be("ACTIVE");
        _attributions.Verify(x => x.AddAsync(It.Is<Attribution>(a => a.WinningSubmissionId == fixture.Submission.SubmissionId), It.IsAny<CancellationToken>()), Times.Once);
        _scoring.Verify(x => x.TriggerScoringAsync(It.Is<Mf03TriggerPayload>(p => p.ApplicationId == created.ApplicationId), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitTransactionAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Decline_ClosesSubmissionWithoutApplicationOrMf03()
    {
        var fixture = CreateConsent(candidateHasAccount: false);
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);

        var response = await Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "DECLINE"
        }, CancellationToken.None);

        response.SubmissionStatus.Should().Be("CONSENT_REJECTED");
        fixture.Consent.Status.Should().Be("DECLINED");
        fixture.Cv.Status.Should().Be("ARCHIVED");
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
        _scoring.Verify(x => x.TriggerScoringAsync(It.IsAny<Mf03TriggerPayload>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExistingCandidateAccount_RequiresMatchingAuthenticatedUser()
    {
        var fixture = CreateConsent();
        _consents.Setup(x => x.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>())).ReturnsAsync(fixture.Consent);

        var action = () => Handler().Handle(new RespondSubmissionConsentCommand
        {
            Token = "valid-token",
            Decision = "CONFIRM",
            RequesterUserId = Guid.NewGuid()
        }, CancellationToken.None);

        await action.Should().ThrowAsync<ForbiddenException>();
        _applications.Verify(x => x.AddAsync(It.IsAny<JobApplication>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private RespondSubmissionConsentCommandHandler Handler() => new(
        _consents.Object,
        _submissions.Object,
        _applications.Object,
        _affiliates.Object,
        _attributions.Object,
        _cvs.Object,
        _notifications.Object,
        _scoring.Object,
        _audit.Object,
        _unitOfWork.Object,
        Mock.Of<ILogger<RespondSubmissionConsentCommandHandler>>());

    private static Fixture CreateConsent(bool candidateHasAccount = true)
    {
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = candidateHasAccount ? Guid.NewGuid() : null,
            FullName = "Nguyen Van A",
            Email = "candidate@example.com"
        };
        var cv = new CandidateCv { CvId = Guid.NewGuid(), CandidateId = candidate.CandidateId, Status = "PENDING_CONSENT", FileName = "cv.pdf" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Status = "ACTIVE",
            Title = "Backend Developer",
            Company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Example Co" }
        };
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            CvId = cv.CvId,
            CandidateCv = cv,
            JobId = job.JobId,
            Job = job,
            SubmittedBy = Guid.NewGuid(),
            Source = "AFFILIATE",
            Status = "PENDING_CONSENT"
        };
        var consent = new SubmissionConsent
        {
            ConsentId = Guid.NewGuid(),
            SubmissionId = submission.SubmissionId,
            Submission = submission,
            RecipientEmail = candidate.Email,
            TokenHash = "hash",
            Status = "PENDING",
            RequestedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        };
        submission.Consent = consent;
        return new Fixture(consent, submission, candidate, cv, job);
    }

    private sealed record Fixture(SubmissionConsent Consent, Submission Submission, Candidate Candidate, CandidateCv Cv, Job Job);
}
