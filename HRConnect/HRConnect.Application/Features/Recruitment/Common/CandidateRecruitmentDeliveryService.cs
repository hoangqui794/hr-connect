using System.Text.Json;
using HRConnect.Application.Common.Email;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.Recruitment.Common;

public interface ICandidateRecruitmentDeliveryService
{
    CandidateRecruitmentDeliveryDecision RequireReachable(Candidate? candidate);

    Task<CandidateRecruitmentDeliveryOutcome> DeliverInterviewAsync(
        JobApplication application,
        Interview interview,
        InterviewCandidateDeliveryEvent deliveryEvent,
        string? reason,
        DateTime occurredAt,
        CandidateRecruitmentDeliveryDecision? decision = null,
        CancellationToken cancellationToken = default);

    Task<CandidateRecruitmentDeliveryOutcome> DeliverOfferAsync(
        Offer offer,
        OfferCandidateDeliveryEvent deliveryEvent,
        string? reason,
        DateTime occurredAt,
        CandidateRecruitmentDeliveryDecision? decision = null,
        CancellationToken cancellationToken = default);
}

public enum InterviewCandidateDeliveryEvent
{
    Scheduled,
    Rescheduled,
    Cancelled
}

public enum OfferCandidateDeliveryEvent
{
    Sent,
    Withdrawn,
    Expired
}

public sealed record CandidateRecruitmentDeliveryOutcome(CandidateRecruitmentDeliveryChannel Channel)
{
    public static CandidateRecruitmentDeliveryOutcome Unavailable { get; } =
        new(CandidateRecruitmentDeliveryChannel.Unavailable);
}

public sealed class CandidateRecruitmentDeliverySettings
{
    public const string SectionName = "CandidateRecruitmentDelivery";

    /// <summary>Public web application origin used by email call-to-action links.</summary>
    public string PortalBaseUrl { get; set; } = "https://hrconnectvn.online";
}

/// <summary>
/// Persists a Candidate notification through the correct durable channel. It deliberately
/// creates either an in-app notification or an email outbox row, never both, to avoid duplicate messages.
/// </summary>
public sealed class CandidateRecruitmentDeliveryService : ICandidateRecruitmentDeliveryService
{
    private readonly INotificationRepository _notifications;
    private readonly IEmailOutboxRepository _emailOutboxes;
    private readonly CandidateRecruitmentDeliverySettings _settings;

    public CandidateRecruitmentDeliveryService(
        INotificationRepository notifications,
        IEmailOutboxRepository emailOutboxes,
        Microsoft.Extensions.Options.IOptions<CandidateRecruitmentDeliverySettings> settings)
    {
        _notifications = notifications;
        _emailOutboxes = emailOutboxes;
        _settings = settings.Value;
    }

    public CandidateRecruitmentDeliveryDecision RequireReachable(Candidate? candidate) =>
        CandidateRecruitmentDeliveryPolicy.RequireReachable(candidate);

    public async Task<CandidateRecruitmentDeliveryOutcome> DeliverInterviewAsync(
        JobApplication application,
        Interview interview,
        InterviewCandidateDeliveryEvent deliveryEvent,
        string? reason,
        DateTime occurredAt,
        CandidateRecruitmentDeliveryDecision? decision = null,
        CancellationToken cancellationToken = default)
    {
        var resolved = decision ?? CandidateRecruitmentDeliveryPolicy.Resolve(application.Candidate);
        if (resolved.Channel == CandidateRecruitmentDeliveryChannel.Unavailable)
        {
            return CandidateRecruitmentDeliveryOutcome.Unavailable;
        }

        if (resolved.Channel == CandidateRecruitmentDeliveryChannel.InApp)
        {
            await _notifications.AddAsync(CreateInterviewNotification(
                application, interview, deliveryEvent, resolved.UserId!.Value, occurredAt), cancellationToken);
        }
        else
        {
            var payload = CreateInterviewEmailPayload(application, interview, reason);
            await _emailOutboxes.AddAsync(new EmailOutbox
            {
                EmailOutboxId = Guid.NewGuid(),
                RecipientEmail = resolved.RecipientEmail!,
                TemplateCode = GetInterviewTemplateCode(deliveryEvent),
                Subject = null,
                Payload = JsonSerializer.Serialize(payload),
                Status = "PENDING",
                RetryCount = 0,
                CreatedAt = occurredAt
            }, cancellationToken);
        }

        return new CandidateRecruitmentDeliveryOutcome(resolved.Channel);
    }

    public async Task<CandidateRecruitmentDeliveryOutcome> DeliverOfferAsync(
        Offer offer,
        OfferCandidateDeliveryEvent deliveryEvent,
        string? reason,
        DateTime occurredAt,
        CandidateRecruitmentDeliveryDecision? decision = null,
        CancellationToken cancellationToken = default)
    {
        var application = offer.Application;
        var resolved = decision ?? CandidateRecruitmentDeliveryPolicy.Resolve(application?.Candidate);
        if (resolved.Channel == CandidateRecruitmentDeliveryChannel.Unavailable)
        {
            return CandidateRecruitmentDeliveryOutcome.Unavailable;
        }

        if (resolved.Channel == CandidateRecruitmentDeliveryChannel.InApp)
        {
            await _notifications.AddAsync(CreateOfferNotification(
                offer, deliveryEvent, resolved.UserId!.Value, occurredAt), cancellationToken);
        }
        else
        {
            var payload = CreateOfferEmailPayload(offer, reason);
            await _emailOutboxes.AddAsync(new EmailOutbox
            {
                EmailOutboxId = Guid.NewGuid(),
                RecipientEmail = resolved.RecipientEmail!,
                TemplateCode = GetOfferTemplateCode(deliveryEvent),
                Subject = null,
                Payload = JsonSerializer.Serialize(payload),
                Status = "PENDING",
                RetryCount = 0,
                CreatedAt = occurredAt
            }, cancellationToken);
        }

        return new CandidateRecruitmentDeliveryOutcome(resolved.Channel);
    }

    private Notification CreateInterviewNotification(
        JobApplication application,
        Interview interview,
        InterviewCandidateDeliveryEvent deliveryEvent,
        Guid userId,
        DateTime occurredAt)
    {
        var (title, message) = deliveryEvent switch
        {
            InterviewCandidateDeliveryEvent.Scheduled => (
                $"Lịch phỏng vấn Vòng {interview.InterviewRound}",
                $"Bạn có lịch phỏng vấn Vòng {interview.InterviewRound} vào lúc {interview.ScheduledAt:dd/MM/yyyy HH:mm}."),
            InterviewCandidateDeliveryEvent.Rescheduled => (
                $"Dời lịch phỏng vấn Vòng {interview.InterviewRound}",
                $"Lịch phỏng vấn Vòng {interview.InterviewRound} đã được dời sang {interview.ScheduledAt:dd/MM/yyyy HH:mm}."),
            _ => (
                $"Huỷ lịch phỏng vấn Vòng {interview.InterviewRound}",
                $"Lịch phỏng vấn Vòng {interview.InterviewRound} đã bị huỷ.")
        };

        return new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            NotificationType = "INTERVIEW",
            Title = title,
            Message = message,
            RelatedEntityType = "INTERVIEW",
            RelatedEntityId = interview.InterviewId,
            Metadata = JsonSerializer.Serialize(new
            {
                applicationId = application.ApplicationId,
                interviewId = interview.InterviewId,
                round = interview.InterviewRound,
                scheduledAt = interview.ScheduledAt,
                eventType = deliveryEvent.ToString().ToUpperInvariant()
            }),
            IsRead = false,
            CreatedAt = occurredAt
        };
    }

    private RecruitmentCandidateEmailPayload CreateInterviewEmailPayload(
        JobApplication application,
        Interview interview,
        string? reason) =>
        new(
            application.Candidate?.FullName ?? "bạn",
            application.Job?.Title ?? "vị trí ứng tuyển",
            application.Job?.Company?.CompanyName,
            BuildCandidatePortalUrl(),
            interview.InterviewRound,
            interview.ScheduledAt,
            interview.DurationMinutes,
            interview.InterviewType,
            interview.Location,
            interview.MeetingLink,
            Reason: reason);

    private Notification CreateOfferNotification(
        Offer offer,
        OfferCandidateDeliveryEvent deliveryEvent,
        Guid userId,
        DateTime occurredAt)
    {
        var application = offer.Application;
        var companyName = application?.Job?.Company?.CompanyName;
        var jobTitle = application?.Job?.Title;
        var companyPrefix = string.IsNullOrWhiteSpace(companyName) ? string.Empty : $" từ {companyName}";
        var (title, message) = deliveryEvent switch
        {
            OfferCandidateDeliveryEvent.Sent => (
                "Bạn nhận được lời mời nhận việc (Offer)",
                $"Bạn vừa nhận được lời mời nhận việc cho vị trí {jobTitle}{companyPrefix}."),
            OfferCandidateDeliveryEvent.Withdrawn => (
                "Lời mời nhận việc đã bị thu hồi",
                $"Lời mời nhận việc{companyPrefix} cho vị trí {jobTitle} đã bị thu hồi."),
            _ => (
                "Offer đã hết hạn phản hồi",
                "Lời mời nhận việc của bạn đã hết hạn phản hồi.")
        };

        return new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            NotificationType = "OFFER",
            Title = title,
            Message = message,
            RelatedEntityType = "OFFER",
            RelatedEntityId = offer.OfferId,
            Metadata = JsonSerializer.Serialize(new
            {
                applicationId = offer.ApplicationId,
                offerId = offer.OfferId,
                offerVersion = offer.OfferVersion,
                expiryDate = offer.ExpiryDate,
                eventType = deliveryEvent.ToString().ToUpperInvariant()
            }),
            IsRead = false,
            CreatedAt = occurredAt
        };
    }

    private RecruitmentCandidateEmailPayload CreateOfferEmailPayload(Offer offer, string? reason) =>
        new(
            offer.Application?.Candidate?.FullName ?? "bạn",
            offer.Application?.Job?.Title ?? "vị trí ứng tuyển",
            offer.Application?.Job?.Company?.CompanyName,
            BuildCandidatePortalUrl(),
            ExpiryDate: offer.ExpiryDate,
            Reason: reason);

    private string BuildCandidatePortalUrl() =>
        $"{_settings.PortalBaseUrl.TrimEnd('/')}/register?role=CANDIDATE&returnTo=%2Fcandidate%2Fdashboard";

    private static string GetInterviewTemplateCode(InterviewCandidateDeliveryEvent deliveryEvent) => deliveryEvent switch
    {
        InterviewCandidateDeliveryEvent.Scheduled => RecruitmentCandidateEmailTemplates.InterviewScheduled,
        InterviewCandidateDeliveryEvent.Rescheduled => RecruitmentCandidateEmailTemplates.InterviewRescheduled,
        InterviewCandidateDeliveryEvent.Cancelled => RecruitmentCandidateEmailTemplates.InterviewCancelled,
        _ => throw new ArgumentOutOfRangeException(nameof(deliveryEvent), deliveryEvent, null)
    };

    private static string GetOfferTemplateCode(OfferCandidateDeliveryEvent deliveryEvent) => deliveryEvent switch
    {
        OfferCandidateDeliveryEvent.Sent => RecruitmentCandidateEmailTemplates.OfferSent,
        OfferCandidateDeliveryEvent.Withdrawn => RecruitmentCandidateEmailTemplates.OfferWithdrawn,
        OfferCandidateDeliveryEvent.Expired => RecruitmentCandidateEmailTemplates.OfferExpired,
        _ => throw new ArgumentOutOfRangeException(nameof(deliveryEvent), deliveryEvent, null)
    };
}
