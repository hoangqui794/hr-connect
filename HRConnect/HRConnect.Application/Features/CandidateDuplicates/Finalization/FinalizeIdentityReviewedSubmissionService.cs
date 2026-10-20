using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.CandidateDuplicates.Finalization;

public sealed record IdentityReviewFinalizationResult(
    Guid SubmissionId,
    string Status,
    Guid? ApplicationId = null,
    string? ReasonCode = null,
    string AiStatus = "NOT_QUEUED");

public interface IFinalizeIdentityReviewedSubmissionService
{
    Task<IdentityReviewFinalizationResult> FinalizeAsync(
        Submission submission,
        Guid actorUserId,
        Guid duplicateCaseId,
        DateTime now,
        CancellationToken cancellationToken = default);
}

public sealed class FinalizeIdentityReviewedSubmissionService : IFinalizeIdentityReviewedSubmissionService
{
    private readonly ISubmissionRepository _submissions;
    private readonly IApplicationRepository _applications;
    private readonly IAffiliateProfileRepository _affiliates;
    private readonly IAttributionRepository _attributions;
    private readonly IFinanceRepository _finance;
    private readonly INotificationRepository _notifications;
    private readonly IMf03ScoringTrigger _scoring;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICandidateCompanyTransactionLock _candidateCompanyLock;
    private readonly IAdminBusinessSettings _businessSettings;

    public FinalizeIdentityReviewedSubmissionService(
        ISubmissionRepository submissions,
        IApplicationRepository applications,
        IAffiliateProfileRepository affiliates,
        IAttributionRepository attributions,
        IFinanceRepository finance,
        INotificationRepository notifications,
        IMf03ScoringTrigger scoring,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        ICandidateCompanyTransactionLock candidateCompanyLock,
        IAdminBusinessSettings businessSettings)
    {
        _submissions = submissions;
        _applications = applications;
        _affiliates = affiliates;
        _attributions = attributions;
        _finance = finance;
        _notifications = notifications;
        _scoring = scoring;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _candidateCompanyLock = candidateCompanyLock;
        _businessSettings = businessSettings;
    }

    public async Task<IdentityReviewFinalizationResult> FinalizeAsync(
        Submission submission,
        Guid actorUserId,
        Guid duplicateCaseId,
        DateTime now,
        CancellationToken cancellationToken = default)
    {
        var existingApplication = await _applications.GetByCandidateAndJobAsync(
            submission.CandidateId, submission.JobId, cancellationToken);
        if (submission.Status == "ACCEPTED" && existingApplication?.AcceptedSubmissionId == submission.SubmissionId)
        {
            return new IdentityReviewFinalizationResult(
                submission.SubmissionId,
                "ALREADY_FINALIZED",
                existingApplication.ApplicationId,
                AiStatus: "PENDING");
        }

        if (submission.Status != "PENDING_IDENTITY_REVIEW" ||
            submission.Consent is not { Status: "CONFIRMED", RespondedAt: not null })
        {
            return new IdentityReviewFinalizationResult(
                submission.SubmissionId, "SKIPPED", ReasonCode: "SUBMISSION_NOT_READY");
        }

        if (submission.Job.Status != JobStatuses.Active)
            return Block(submission, "CANCELLED", "JOB_NOT_ACTIVE", now);

        var affiliate = await _affiliates.GetByUserIdWithDetailsAsync(
            submission.SubmittedBy, cancellationToken);
        if (!SubmissionAcceptancePolicy.IsAffiliateEligible(affiliate))
            return Block(submission, "CANCELLED", "AFFILIATE_NOT_ELIGIBLE", now);

        if (submission.ReplacementSlotId.HasValue)
        {
            var replacementSlot = await _finance.GetReplacementSlotForConsentForUpdateAsync(
                submission.ReplacementSlotId.Value, cancellationToken);
            if (replacementSlot == null ||
                replacementSlot.JobId != submission.JobId ||
                !string.Equals(replacementSlot.Status, ReplacementSlotStates.Open, StringComparison.Ordinal) ||
                !replacementSlot.ExpiresAt.HasValue ||
                replacementSlot.ExpiresAt.Value <= now)
            {
                return Block(submission, "CANCELLED", ReplacementSlotErrorCodes.Unavailable, now);
            }
        }

        if (SubmissionAcceptancePolicy.EnforcesClientOwnership(submission.Job.ServiceType?.Code))
        {
            await _candidateCompanyLock.AcquireAsync(
                submission.CandidateId, submission.Job.CompanyId, cancellationToken);
            var ownershipDays = await _businessSettings.GetIntAsync(
                BusinessSettingKeys.Mf02ClientOwnershipDays, cancellationToken);
            var isOwnedByClient = await _applications.ExistsForCandidateAndCompanySinceAsync(
                submission.CandidateId,
                submission.Job.CompanyId,
                now.AddDays(-ownershipDays),
                cancellationToken);
            if (isOwnedByClient)
                return Block(submission, "BLOCKED_CLIENT_OWNED", "CANDIDATE_OWNED_BY_CLIENT", now);
        }

        var accepted = await _submissions.GetAcceptedSubmissionAsync(
            submission.CandidateId, submission.JobId, cancellationToken);
        existingApplication ??= await _applications.GetByCandidateAndJobAsync(
            submission.CandidateId, submission.JobId, cancellationToken);
        if (accepted != null || existingApplication != null)
        {
            submission.DuplicateOfSubmissionId = accepted?.SubmissionId ?? existingApplication?.AcceptedSubmissionId;
            return Block(submission, "BLOCKED_DUPLICATE", "CANDIDATE_ALREADY_SUBMITTED", now);
        }

        submission.Status = "ACCEPTED";
        submission.UpdatedAt = now;
        _submissions.Update(submission);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            JobId = submission.JobId,
            CandidateId = submission.CandidateId,
            AcceptedSubmissionId = submission.SubmissionId,
            ReplacementSlotId = submission.ReplacementSlotId,
            Status = "SUBMITTED",
            CurrentStage = "SUBMITTED",
            AppliedAt = now,
            UpdatedAt = now
        };
        await _applications.AddAsync(application, cancellationToken);
        await _attributions.AddAsync(new Attribution
        {
            AttributionId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            AffiliateId = affiliate!.AffiliateId,
            WinningSubmissionId = submission.SubmissionId,
            AttributionRule = "EARLIEST_CANDIDATE_CONFIRMED_VALID_SUBMISSION",
            Status = "ACTIVE",
            EstablishedAt = now,
            UpdatedAt = now
        }, cancellationToken);
        await _scoring.TriggerScoringAsync(new Mf03TriggerPayload(
            application.ApplicationId,
            submission.CvId,
            submission.JobId,
            submission.SubmittedBy), cancellationToken);

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.SubmissionIdentityReviewFinalized,
            EntityType = "SUBMISSION",
            EntityId = submission.SubmissionId,
            ActorUserId = actorUserId,
            CorrelationId = duplicateCaseId,
            OldValues = new { status = "PENDING_IDENTITY_REVIEW" },
            NewValues = new
            {
                status = "ACCEPTED",
                application.ApplicationId,
                attributionRule = "EARLIEST_CANDIDATE_CONFIRMED_VALID_SUBMISSION",
                aiStatus = "PENDING"
            }
        }, cancellationToken);

        if (submission.Candidate.UserId.HasValue)
        {
            await AddNotificationAsync(
                submission.Candidate.UserId.Value,
                "Hồ sơ đã được tiếp nhận",
                $"Hồ sơ của bạn cho vị trí {submission.Job.Title} đã hoàn tất đối chiếu và được tiếp nhận.",
                "APPLICATION",
                application.ApplicationId,
                now,
                cancellationToken);
        }
        await AddNotificationAsync(
            submission.SubmittedBy,
            "Ứng viên đã hoàn tất đối chiếu",
            $"Hồ sơ giới thiệu cho vị trí {submission.Job.Title} đã được tiếp nhận.",
            "SUBMISSION",
            submission.SubmissionId,
            now,
            cancellationToken);

        return new IdentityReviewFinalizationResult(
            submission.SubmissionId,
            "ACCEPTED",
            application.ApplicationId,
            AiStatus: "PENDING");
    }

    private IdentityReviewFinalizationResult Block(
        Submission submission,
        string status,
        string reasonCode,
        DateTime now)
    {
        submission.Status = status;
        submission.UpdatedAt = now;
        _submissions.Update(submission);
        return new IdentityReviewFinalizationResult(
            submission.SubmissionId, status, ReasonCode: reasonCode);
    }

    private async Task AddNotificationAsync(
        Guid userId,
        string title,
        string message,
        string relatedEntityType,
        Guid relatedEntityId,
        DateTime now,
        CancellationToken cancellationToken) =>
        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            NotificationType = "CANDIDATE_IDENTITY",
            Title = title,
            Message = message,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            Metadata = "{}",
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);
}
