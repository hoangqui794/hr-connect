using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Affiliates.Commands.ResendSubmissionConsent;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public sealed class ResendSubmissionConsentCommandHandlerTests
{
    [Fact]
    public async Task Handle_OwnPendingSubmission_RotatesTokenAndSendsEmail()
    {
        var ownerId = Guid.NewGuid();
        var consent = CreateConsent(ownerId);
        var oldHash = consent.TokenHash;
        var repository = new Mock<ISubmissionConsentRepository>();
        repository.Setup(x => x.GetBySubmissionIdAsync(consent.SubmissionId, It.IsAny<CancellationToken>())).ReturnsAsync(consent);
        var email = new Mock<IEmailService>();
        email.Setup(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(EmailResult.Success("message-id"));
        var unitOfWork = new Mock<IUnitOfWork>();

        var handler = new ResendSubmissionConsentCommandHandler(
            repository.Object, Mock.Of<IEmailOutboxRepository>(), email.Object,
            Mock.Of<IAuditLogService>(), unitOfWork.Object,
            Options.Create(new SubmissionConsentSettings { ResendCooldownMinutes = 2, MaxEmailSends = 5 }),
            Mock.Of<ILogger<ResendSubmissionConsentCommandHandler>>());

        var result = await handler.Handle(new ResendSubmissionConsentCommand(consent.SubmissionId, ownerId), CancellationToken.None);

        result.EmailDeliveryStatus.Should().Be("SENT");
        consent.TokenHash.Should().NotBe(oldHash);
        consent.EmailSendCount.Should().Be(2);
        email.Verify(x => x.SendEmailAsync(consent.RecipientEmail, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_DifferentAffiliate_IsForbidden()
    {
        var consent = CreateConsent(Guid.NewGuid());
        var repository = new Mock<ISubmissionConsentRepository>();
        repository.Setup(x => x.GetBySubmissionIdAsync(consent.SubmissionId, It.IsAny<CancellationToken>())).ReturnsAsync(consent);
        var handler = new ResendSubmissionConsentCommandHandler(
            repository.Object, Mock.Of<IEmailOutboxRepository>(), Mock.Of<IEmailService>(),
            Mock.Of<IAuditLogService>(), Mock.Of<IUnitOfWork>(), Options.Create(new SubmissionConsentSettings()),
            Mock.Of<ILogger<ResendSubmissionConsentCommandHandler>>());

        var action = () => handler.Handle(new ResendSubmissionConsentCommand(consent.SubmissionId, Guid.NewGuid()), CancellationToken.None);
        await action.Should().ThrowAsync<ForbiddenException>();
    }

    private static SubmissionConsent CreateConsent(Guid ownerId)
    {
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Candidate", Email = "candidate@example.com" };
        var job = new Job { JobId = Guid.NewGuid(), Title = "Developer", Company = new Company { CompanyName = "Company" } };
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(), CandidateId = candidate.CandidateId, Candidate = candidate,
            JobId = job.JobId, Job = job, SubmittedBy = ownerId, Source = "AFFILIATE", Status = "PENDING_CONSENT"
        };
        return new SubmissionConsent
        {
            ConsentId = Guid.NewGuid(), SubmissionId = submission.SubmissionId, Submission = submission,
            RecipientEmail = candidate.Email, TokenHash = "old-hash", Status = "PENDING",
            RequestedAt = DateTime.UtcNow.AddMinutes(-10), ExpiresAt = DateTime.UtcNow.AddHours(24),
            EmailSendCount = 1, EmailSentAt = DateTime.UtcNow.AddMinutes(-10), UpdatedAt = DateTime.UtcNow.AddMinutes(-10)
        };
    }
}
