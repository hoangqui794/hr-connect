using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;
using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.SubmissionConsents;

public sealed class GetSubmissionConsentQueryHandlerTests
{
    [Fact]
    public async Task Handle_WhenPendingConsentHasExpired_ClosesItAndNotifiesAffiliate()
    {
        var consents = new Mock<ISubmissionConsentRepository>();
        var storage = new Mock<ICvStorageService>();
        var expiryService = new Mock<ISubmissionConsentExpiryService>();
        var audit = new Mock<IAuditLogService>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Candidate", Status = "ACTIVE" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Backend Developer",
            Company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Example" }
        };
        var cv = new CandidateCv { CvId = Guid.NewGuid(), CandidateId = candidate.CandidateId, Status = "PENDING_CONSENT", FileName = "cv.pdf" };
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
            Status = "PENDING_CONSENT"
        };
        var consent = new SubmissionConsent
        {
            ConsentId = Guid.NewGuid(),
            SubmissionId = submission.SubmissionId,
            Submission = submission,
            TokenHash = "hash",
            RecipientEmail = "candidate@example.com",
            Status = "PENDING",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-1)
        };
        consents.Setup(repository => repository.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(consent);
        expiryService.Setup(service => service.ExpireAsync(
                consent, It.IsAny<DateTime>(), null, "CONSENT_REVIEW", It.IsAny<CancellationToken>()))
            .Callback(() =>
            {
                consent.Status = "EXPIRED";
                submission.Status = "CONSENT_EXPIRED";
                cv.Status = "ARCHIVED";
            })
            .ReturnsAsync(true);

        var result = await new GetSubmissionConsentQueryHandler(
            consents.Object, storage.Object, expiryService.Object, audit.Object, unitOfWork.Object).Handle(
            new GetSubmissionConsentQuery("expired-token", null, null), CancellationToken.None);

        result.Data!.Status.Should().Be("EXPIRED");
        submission.Status.Should().Be("CONSENT_EXPIRED");
        cv.Status.Should().Be("ARCHIVED");
        expiryService.Verify(service => service.ExpireAsync(
            consent, It.IsAny<DateTime>(), null, "CONSENT_REVIEW", It.IsAny<CancellationToken>()), Times.Once);
        storage.Verify(service => service.GetCvDownloadUrlAsync(
            It.IsAny<Guid>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenPendingConsentIsViewedByEmailLink_AuditsCvUrlIssuanceWithoutTokenOrUrl()
    {
        var consents = new Mock<ISubmissionConsentRepository>();
        var storage = new Mock<ICvStorageService>();
        var expiryService = new Mock<ISubmissionConsentExpiryService>();
        var audit = new Mock<IAuditLogService>();
        var unitOfWork = new Mock<IUnitOfWork>();
        AuditEntry? capturedAudit = null;
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Candidate", Status = "ACTIVE" };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Backend Developer",
            Company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Example" }
        };
        var cv = new CandidateCv
        {
            CvId = Guid.NewGuid(), CandidateId = candidate.CandidateId, Status = "PENDING_CONSENT", FileName = "cv.pdf"
        };
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(), CandidateId = candidate.CandidateId, Candidate = candidate,
            CvId = cv.CvId, CandidateCv = cv, JobId = job.JobId, Job = job,
            SubmittedBy = Guid.NewGuid(), Status = "PENDING_CONSENT"
        };
        var consent = new SubmissionConsent
        {
            ConsentId = Guid.NewGuid(), SubmissionId = submission.SubmissionId, Submission = submission,
            TokenHash = "hash", RecipientEmail = "candidate@example.com", Status = "PENDING",
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        };
        var expiresAt = DateTime.UtcNow.AddMinutes(5);
        consents.Setup(repository => repository.GetByTokenHashAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(consent);
        storage.Setup(service => service.GetCvDownloadUrlAsync(cv.CvId, TimeSpan.FromMinutes(5), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CvDownloadUrlResult
            {
                CvId = cv.CvId,
                DownloadUrl = "https://storage.example/signed-url?token=secret",
                ExpiresAt = expiresAt
            });
        audit.Setup(service => service.AddAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
            .Callback<AuditEntry, CancellationToken>((entry, _) => capturedAudit = entry)
            .Returns(Task.CompletedTask);

        var result = await new GetSubmissionConsentQueryHandler(
            consents.Object, storage.Object, expiryService.Object, audit.Object, unitOfWork.Object).Handle(
            new GetSubmissionConsentQuery("email-token", null, null), CancellationToken.None);

        result.Data!.CvDownloadUrl.Should().NotBeNull();
        audit.Verify(service => service.AddAsync(It.Is<AuditEntry>(entry =>
            entry.Action == AuditActions.SubmissionConsentCvDownloadUrlIssued &&
            entry.EntityId == cv.CvId &&
            entry.ActorUserId == null &&
            entry.CorrelationId == consent.ConsentId), It.IsAny<CancellationToken>()), Times.Once);
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        JsonSerializer.Serialize(capturedAudit!.NewValues).Should().NotContain("signed-url").And.NotContain("secret");
    }
}
