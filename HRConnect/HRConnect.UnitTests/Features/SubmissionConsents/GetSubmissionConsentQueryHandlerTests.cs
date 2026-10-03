using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.SubmissionConsents.GetSubmissionConsent;
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
        var notifications = new Mock<INotificationRepository>();
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

        var result = await new GetSubmissionConsentQueryHandler(
            consents.Object, storage.Object, notifications.Object, unitOfWork.Object).Handle(
            new GetSubmissionConsentQuery("expired-token", null, null), CancellationToken.None);

        result.Data!.Status.Should().Be("EXPIRED");
        submission.Status.Should().Be("CONSENT_EXPIRED");
        cv.Status.Should().Be("ARCHIVED");
        notifications.Verify(repository => repository.AddAsync(It.Is<Notification>(notification =>
            notification.UserId == submission.SubmittedBy &&
            notification.NotificationType == "SUBMISSION_CONSENT_RESULT" &&
            notification.Title.Contains("hết hạn")), It.IsAny<CancellationToken>()), Times.Once);
        storage.Verify(service => service.GetCvDownloadUrlAsync(
            It.IsAny<Guid>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()), Times.Never);
        unitOfWork.Verify(unit => unit.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
