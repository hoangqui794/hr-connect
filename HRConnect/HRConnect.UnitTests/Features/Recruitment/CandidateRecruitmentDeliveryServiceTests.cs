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
    public async Task DeliverInterviewAsync_WithLinkedAccountAndEmail_CreatesInAppAndQueuesEmail()
    {
        var userId = Guid.NewGuid();
        var (application, interview) = CreateApplication(new Candidate
        {
            UserId = userId,
            FullName = "An",
            Email = "candidate@example.com"
        });
        EmailOutbox? outbox = null;
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((value, _) => outbox = value)
            .Returns(Task.CompletedTask);

        var result = await CreateService().DeliverInterviewAsync(
            application, interview, InterviewCandidateDeliveryEvent.Scheduled, null, DateTime.UtcNow);

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.InAppAndEmail);
        _notifications.Verify(x => x.AddAsync(
            It.Is<Notification>(item => item.UserId == userId && item.NotificationType == "INTERVIEW"),
            It.IsAny<CancellationToken>()), Times.Once);
        outbox.Should().NotBeNull();
        outbox!.UserId.Should().Be(userId);
        outbox.RecipientEmail.Should().Be("candidate@example.com");
        outbox.TemplateCode.Should().Be(RecruitmentCandidateEmailTemplates.InterviewScheduled);
        var payload = JsonSerializer.Deserialize<RecruitmentCandidateEmailPayload>(outbox.Payload)!;
        payload.HasLinkedAccount.Should().BeTrue();
        payload.PortalUrl.Should().Be($"https://portal.example/candidate/interviews/{interview.InterviewId}");
    }

    [Fact]
    public async Task DeliverInterviewAsync_WithLinkedAccountButNoValidEmail_CreatesOnlyInAppNotification()
    {
        var userId = Guid.NewGuid();
        var (application, interview) = CreateApplication(new Candidate
        {
            UserId = userId,
            FullName = "An",
            Email = "not-an-email"
        });

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
        payload.PortalUrl.Should().Be("https://portal.example/register?role=CANDIDATE&returnTo=%2Fcandidate%2Fdashboard");
        payload.Reason.Should().Be("Trùng lịch");
        payload.HasLinkedAccount.Should().BeFalse();
    }

    [Fact]
    public async Task DeliverInterviewAsync_WhenDetailsUpdated_UsesUpdatedTemplateAndSafeMetadata()
    {
        var userId = Guid.NewGuid();
        var (application, interview) = CreateApplication(new Candidate { UserId = userId, FullName = "An" });
        Notification? notice = null;
        _notifications.Setup(x => x.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .Callback<Notification, CancellationToken>((value, _) => notice = value)
            .Returns(Task.CompletedTask);

        await CreateService().DeliverInterviewAsync(
            application, interview, InterviewCandidateDeliveryEvent.Updated, null, DateTime.UtcNow);

        notice.Should().NotBeNull();
        notice!.Message.Should().Contain("kiểm tra lại");
        using var metadata = JsonDocument.Parse(notice.Metadata!);
        metadata.RootElement.GetProperty("eventType").GetString().Should().Be("UPDATED");
        metadata.RootElement.GetProperty("applicationId").GetGuid().Should().Be(application.ApplicationId);
        metadata.RootElement.GetProperty("routeHint").GetString().Should().Be($"/candidate/applications/{application.ApplicationId}");
        notice.Metadata.Should().NotContain("participant");
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

    [Fact]
    public async Task DeliverApplicationOutcomeAsync_WithUnlinkedEmail_QueuesSafeNotStartedEmail()
    {
        var (application, _) = CreateApplication(new Candidate
        {
            FullName = "An",
            Email = "candidate@example.com"
        });
        EmailOutbox? outbox = null;
        _outboxes.Setup(x => x.AddAsync(It.IsAny<EmailOutbox>(), It.IsAny<CancellationToken>()))
            .Callback<EmailOutbox, CancellationToken>((value, _) => outbox = value)
            .Returns(Task.CompletedTask);

        var result = await CreateService().DeliverApplicationOutcomeAsync(
            application,
            ApplicationCandidateDeliveryEvent.NotStartedReported,
            "Thông tin nội bộ không được đưa vào email",
            DateTime.UtcNow);

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.Email);
        outbox!.TemplateCode.Should().Be(RecruitmentCandidateEmailTemplates.ApplicationNotStartedReported);
        outbox.Payload.Should().Contain("Backend Developer");
        outbox.Payload.Should().NotContain("salary");
        outbox.Payload.Should().NotContain("Thông tin nội bộ không được đưa vào email");
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
