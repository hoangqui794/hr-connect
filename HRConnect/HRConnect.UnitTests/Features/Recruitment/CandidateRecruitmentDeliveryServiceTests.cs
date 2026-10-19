using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Email;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Options;
using Moq;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Recruitment;

public class CandidateRecruitmentDeliveryServiceTests
{
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IEmailOutboxRepository> _outboxes = new();

    private CandidateRecruitmentDeliveryService CreateService() => new(
        _notifications.Object,
        _outboxes.Object,
        Options.Create(new CandidateRecruitmentDeliverySettings
        {
            PortalBaseUrl = "https://portal.example"
        }));

    [Fact]
    public async Task DeliverInterviewAsync_WithLinkedAccount_CreatesOnlyInAppNotification()
    {
        var userId = Guid.NewGuid();
        var (application, interview) = CreateApplication(new Candidate { UserId = userId, FullName = "An" });

        var result = await CreateService().DeliverInterviewAsync(
            application, interview, InterviewCandidateDeliveryEvent.Scheduled, null, DateTime.UtcNow);

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.InApp);
        _notifications.Verify(x => x.AddAsync(
            It.Is<Notification>(item => item.UserId == userId && item.NotificationType == "INTERVIEW"),
            It.IsAny<CancellationToken>()), Times.Once);
        _outboxes.Verify(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeliverInterviewAsync_WithUnlinkedEmail_QueuesSafeEmail()
    {
        var (application, interview) = CreateApplication(new Candidate
        {
            FullName = "An",
            Email = "candidate@example.com"
        });
        EmailOutbox? outbox = null;
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((value, _) => outbox = value)
            .Returns(Task.CompletedTask);

        var result = await CreateService().DeliverInterviewAsync(
            application, interview, InterviewCandidateDeliveryEvent.Rescheduled, "Trùng lịch", DateTime.UtcNow);

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.Email);
        outbox.Should().NotBeNull();
        outbox!.TemplateCode.Should().Be(RecruitmentCandidateEmailTemplates.InterviewRescheduled);
        outbox.RecipientEmail.Should().Be("candidate@example.com");
        var payload = JsonSerializer.Deserialize<RecruitmentCandidateEmailPayload>(outbox.Payload)!;
        payload.PortalUrl.Should().Be("https://portal.example/register?role=CANDIDATE");
        payload.Reason.Should().Be("Trùng lịch");
    }

    [Fact]
    public async Task DeliverInterviewAsync_WithoutDeliveryChannel_IsBestEffortForChanges()
    {
        var (application, interview) = CreateApplication(new Candidate { FullName = "An" });

        var result = await CreateService().DeliverInterviewAsync(
            application, interview, InterviewCandidateDeliveryEvent.Cancelled, "Đổi kế hoạch", DateTime.UtcNow);

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.Unavailable);
        _notifications.Verify(x => x.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Never);
        _outboxes.Verify(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeliverOfferAsync_WithUnlinkedEmail_QueuesOfferWithoutSensitiveFields()
    {
        var (application, _) = CreateApplication(new Candidate
        {
            FullName = "An",
            Email = "candidate@example.com"
        });
        var offer = new Offer
        {
            OfferId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            Application = application,
            OfferVersion = 2,
            Salary = 42_000_000m,
            OfferDocumentUrl = "https://private.example/offer.pdf",
            ExpiryDate = new DateOnly(2026, 10, 30)
        };
        EmailOutbox? outbox = null;
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((value, _) => outbox = value)
            .Returns(Task.CompletedTask);

        var result = await CreateService().DeliverOfferAsync(
            offer, OfferCandidateDeliveryEvent.Sent, null, DateTime.UtcNow);

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.Email);
        outbox!.TemplateCode.Should().Be(RecruitmentCandidateEmailTemplates.OfferSent);
        outbox.Payload.Should().NotContain("42000000");
        outbox.Payload.Should().NotContain("private.example");
    }

    private static (JobApplication Application, Interview Interview) CreateApplication(Candidate candidate)
    {
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            Candidate = candidate,
            Job = new Job
            {
                Title = "Backend Developer",
                Company = new Company { CompanyName = "Contoso" }
            }
        };
        var interview = new Interview
        {
            InterviewId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            InterviewRound = 1,
            ScheduledAt = DateTime.UtcNow.AddDays(1),
            DurationMinutes = 60,
            InterviewType = "ONLINE",
            Application = application
        };
        return (application, interview);
    }
}
