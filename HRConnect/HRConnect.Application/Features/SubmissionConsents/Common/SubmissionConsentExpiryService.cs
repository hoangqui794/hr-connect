using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.SubmissionConsents.Common;

public sealed class SubmissionConsentExpiryService : ISubmissionConsentExpiryService
{
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public SubmissionConsentExpiryService(
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _notifications = notifications;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> ExpireAsync(
        SubmissionConsent consent,
        DateTime now,
        Guid? actorUserId,
        string source,
        CancellationToken cancellationToken = default)
    {
        if (consent.Status != "PENDING" || consent.ExpiresAt > now)
        {
            return false;
        }

        var previousConsentStatus = consent.Status;
        var previousSubmissionStatus = consent.Submission.Status;
        var previousCvStatus = consent.Submission.CandidateCv.Status;

        consent.Status = "EXPIRED";
        consent.UpdatedAt = now;
        consent.ConcurrencyToken = Guid.NewGuid();
        consent.Submission.Status = "CONSENT_EXPIRED";
        consent.Submission.UpdatedAt = now;
        if (consent.Submission.CandidateCv.Status == "PENDING_CONSENT")
        {
            consent.Submission.CandidateCv.Status = "ARCHIVED";
            consent.Submission.CandidateCv.UpdatedAt = now;
        }

        var notificationExists = await _notifications.ExistsAsync(
            consent.Submission.SubmittedBy,
            SubmissionConsentNotificationFactory.NotificationType,
            "SUBMISSION",
            consent.SubmissionId,
            cancellationToken);
        if (!notificationExists)
        {
            await _notifications.AddAsync(
                SubmissionConsentNotificationFactory.CreateAffiliateResult(consent.Submission, "EXPIRED", now),
                cancellationToken);
        }

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.SubmissionConsentExpired,
            EntityType = "SUBMISSION",
            EntityId = consent.SubmissionId,
            ActorUserId = actorUserId,
            CorrelationId = consent.ConsentId,
            OldValues = new
            {
                consentStatus = previousConsentStatus,
                submissionStatus = previousSubmissionStatus,
                cvStatus = previousCvStatus
            },
            NewValues = new
            {
                consentStatus = consent.Status,
                submissionStatus = consent.Submission.Status,
                cvStatus = consent.Submission.CandidateCv.Status,
                source
            }
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
