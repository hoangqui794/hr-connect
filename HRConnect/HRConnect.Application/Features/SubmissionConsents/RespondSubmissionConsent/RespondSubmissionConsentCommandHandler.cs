using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;
using Microsoft.Extensions.Logging;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.Application.Features.SubmissionConsents.RespondSubmissionConsent;

public sealed class RespondSubmissionConsentCommandHandler : IRequestHandler<RespondSubmissionConsentCommand, RespondSubmissionConsentResponse>
{
    private readonly ISubmissionConsentRepository _consentRepository;
    private readonly ISubmissionRepository _submissionRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly IAffiliateProfileRepository _affiliateRepository;
    private readonly IAttributionRepository _attributionRepository;
    private readonly ICandidateCvRepository _cvRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IMf03ScoringTrigger _scoringTrigger;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RespondSubmissionConsentCommandHandler> _logger;

    public RespondSubmissionConsentCommandHandler(
        ISubmissionConsentRepository consentRepository,
        ISubmissionRepository submissionRepository,
        IApplicationRepository applicationRepository,
        IAffiliateProfileRepository affiliateRepository,
        IAttributionRepository attributionRepository,
        ICandidateCvRepository cvRepository,
        INotificationRepository notificationRepository,
        IMf03ScoringTrigger scoringTrigger,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        ILogger<RespondSubmissionConsentCommandHandler> logger)
    {
        _consentRepository = consentRepository;
        _submissionRepository = submissionRepository;
        _applicationRepository = applicationRepository;
        _affiliateRepository = affiliateRepository;
        _attributionRepository = attributionRepository;
        _cvRepository = cvRepository;
        _notificationRepository = notificationRepository;
        _scoringTrigger = scoringTrigger;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<RespondSubmissionConsentResponse> Handle(RespondSubmissionConsentCommand request, CancellationToken cancellationToken)
    {
        var decision = request.Decision.Trim().ToUpperInvariant();
        var consent = await ResolveConsentAsync(request, cancellationToken);

        if (consent.Status != "PENDING")
        {
            if ((consent.Status == "CONFIRMED" && decision == "CONFIRM") ||
                (consent.Status == "DECLINED" && decision == "DECLINE"))
                return ExistingResponse(consent);

            throw new ConflictException($"Yêu cầu xác nhận đã kết thúc với trạng thái {consent.Status}.");
        }

        var now = DateTime.UtcNow;
        if (consent.ExpiresAt <= now)
        {
            await SetTerminalWithoutApplicationAsync(consent, "EXPIRED", "CONSENT_EXPIRED", request, now, cancellationToken);
            throw new BadRequestException("Yêu cầu xác nhận đã hết hạn. Affiliate cần tạo lượt nộp mới.");
        }

        if (decision == "DECLINE")
        {
            await SetTerminalWithoutApplicationAsync(consent, "DECLINED", "CONSENT_REJECTED", request, now, cancellationToken);
            return new RespondSubmissionConsentResponse
            {
                Message = "Bạn đã từ chối cho phép sử dụng hồ sơ cho công việc này.",
                SubmissionId = consent.SubmissionId,
                SubmissionStatus = "CONSENT_REJECTED"
            };
        }

        if (consent.Submission.Job.Status != JobStatuses.Active)
        {
            await SetTerminalWithoutApplicationAsync(consent, "CANCELLED", "CANCELLED", request, now, cancellationToken);
            throw new ConflictException("Công việc hiện không còn nhận hồ sơ.");
        }

        var candidate = consent.Submission.Candidate;
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
        {
            await SetTerminalWithoutApplicationAsync(consent, "CANCELLED", "CANCELLED", request, now, cancellationToken);
            throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất nên không thể xác nhận lượt nộp này.");
        }

        var existingSubmission = await _submissionRepository.GetAcceptedSubmissionAsync(
            consent.Submission.CandidateId, consent.Submission.JobId, cancellationToken);
        var existingApplication = await _applicationRepository.GetByCandidateAndJobAsync(
            consent.Submission.CandidateId, consent.Submission.JobId, cancellationToken);
        if (existingSubmission != null || existingApplication != null)
        {
            consent.Submission.DuplicateOfSubmissionId = existingSubmission?.SubmissionId;
            await SetTerminalWithoutApplicationAsync(consent, "CANCELLED", "BLOCKED_DUPLICATE", request, now, cancellationToken);
            throw new ConflictException("Candidate đã có hồ sơ được tiếp nhận cho công việc này.");
        }

        var affiliate = await _affiliateRepository.GetByUserIdWithDetailsAsync(consent.Submission.SubmittedBy, cancellationToken);
        if (affiliate == null || !IsAffiliateEligible(affiliate))
        {
            await SetTerminalWithoutApplicationAsync(consent, "CANCELLED", "CANCELLED", request, now, cancellationToken);
            throw new ConflictException("Affiliate đã bị khóa, chưa được phê duyệt hoặc không còn hoạt động nên lượt nộp không thể tiếp tục.");
        }

        JobApplication application;
        try
        {
            await _unitOfWork.BeginTransactionAsync(cancellationToken);
            consent.Status = "CONFIRMED";
            consent.RespondedAt = now;
            consent.ResponseIp = Limit(request.IpAddress, 64);
            consent.ResponseUserAgent = Limit(request.UserAgent, 512);
            consent.UpdatedAt = now;

            consent.Submission.Status = "ACCEPTED";
            consent.Submission.UpdatedAt = now;
            if (consent.Submission.CandidateCv.Status == "PENDING_CONSENT")
            {
                consent.Submission.CandidateCv.Status = "ACTIVE";
                consent.Submission.CandidateCv.UpdatedAt = now;
                _cvRepository.Update(consent.Submission.CandidateCv);
            }

            // Persist the accepted submission first inside the same transaction.
            // PostgreSQL validates accepted_submission_id when the application row is
            // inserted, so it must be able to observe the ACCEPTED status at that point.
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            application = new JobApplication
            {
                ApplicationId = Guid.NewGuid(),
                JobId = consent.Submission.JobId,
                CandidateId = consent.Submission.CandidateId,
                AcceptedSubmissionId = consent.SubmissionId,
                Status = "SUBMITTED",
                CurrentStage = "SUBMITTED",
                AppliedAt = now,
                UpdatedAt = now
            };
            await _applicationRepository.AddAsync(application, cancellationToken);

            await _attributionRepository.AddAsync(new HRConnect.Domain.Entities.Attribution
            {
                AttributionId = Guid.NewGuid(),
                ApplicationId = application.ApplicationId,
                AffiliateId = affiliate.AffiliateId,
                WinningSubmissionId = consent.SubmissionId,
                AttributionRule = "CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED",
                Status = "ACTIVE",
                EstablishedAt = now,
                UpdatedAt = now
            }, cancellationToken);

            await _scoringTrigger.TriggerScoringAsync(new Mf03TriggerPayload(
                application.ApplicationId,
                consent.Submission.CvId,
                consent.Submission.JobId,
                consent.Submission.SubmittedBy), cancellationToken);

            await _audit.AddAsync(new AuditEntry
            {
                Action = AuditActions.SubmissionConsentConfirmed,
                EntityType = "SUBMISSION",
                EntityId = consent.SubmissionId,
                ActorUserId = request.RequesterUserId,
                OldValues = new { status = "PENDING_CONSENT" },
                NewValues = new { status = "ACCEPTED", application.ApplicationId, aiStatus = "PENDING" }
            }, cancellationToken);

            if (consent.Submission.Candidate.UserId.HasValue)
            {
                await _notificationRepository.AddAsync(new HRConnect.Domain.Entities.Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = consent.Submission.Candidate.UserId.Value,
                    NotificationType = "SUBMISSION",
                    Title = "Hồ sơ ứng tuyển đã được xác nhận",
                    Message = $"Hồ sơ của bạn cho vị trí {consent.Submission.Job.Title} đã được tiếp nhận.",
                    RelatedEntityType = "APPLICATION",
                    RelatedEntityId = application.ApplicationId,
                    Metadata = "{}",
                    IsRead = false,
                    CreatedAt = now
                }, cancellationToken);
            }

            await _unitOfWork.CommitTransactionAsync(cancellationToken);
        }
        catch (Exception ex) when (IsUniqueViolation(ex))
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            await MarkRaceAsDuplicateAsync(consent.SubmissionId, request, cancellationToken);
            throw new ConflictException("Candidate đã có hồ sơ được tiếp nhận cho công việc này.");
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }

        return new RespondSubmissionConsentResponse
        {
            Message = "Xác nhận thành công. Hồ sơ đã được tiếp nhận và chuyển sang MF03 để chấm điểm.",
            SubmissionId = consent.SubmissionId,
            SubmissionStatus = "ACCEPTED",
            ApplicationId = application.ApplicationId,
            AiStatus = "PENDING"
        };
    }

    private async Task SetTerminalWithoutApplicationAsync(
        HRConnect.Domain.Entities.SubmissionConsent consent,
        string consentStatus,
        string submissionStatus,
        RespondSubmissionConsentCommand request,
        DateTime now,
        CancellationToken cancellationToken)
    {
        consent.Status = consentStatus;
        consent.RespondedAt = now;
        consent.ResponseIp = Limit(request.IpAddress, 64);
        consent.ResponseUserAgent = Limit(request.UserAgent, 512);
        consent.UpdatedAt = now;
        consent.Submission.Status = submissionStatus;
        consent.Submission.UpdatedAt = now;
        if (consent.Submission.CandidateCv.Status == "PENDING_CONSENT")
        {
            consent.Submission.CandidateCv.Status = "ARCHIVED";
            consent.Submission.CandidateCv.UpdatedAt = now;
        }
        await _audit.AddAsync(new AuditEntry
        {
            Action = consentStatus == "DECLINED" ? AuditActions.SubmissionConsentDeclined : AuditActions.SubmissionConsentClosed,
            EntityType = "SUBMISSION",
            EntityId = consent.SubmissionId,
            ActorUserId = request.RequesterUserId,
            NewValues = new { consentStatus, submissionStatus }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<HRConnect.Domain.Entities.SubmissionConsent> ResolveConsentAsync(
        RespondSubmissionConsentCommand request,
        CancellationToken cancellationToken)
    {
        if (request.SubmissionId.HasValue)
        {
            if (!request.RequesterUserId.HasValue)
                throw new ForbiddenException("Vui lòng đăng nhập tài khoản Candidate để xác nhận hồ sơ.");

            var consent = await _consentRepository.GetBySubmissionIdAsync(request.SubmissionId.Value, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hồ sơ.");
            if (consent.Submission.Candidate.UserId != request.RequesterUserId)
                throw new ForbiddenException("Bạn không có quyền xác nhận hồ sơ của Candidate khác.");
            return consent;
        }

        if (string.IsNullOrWhiteSpace(request.Token))
            throw new BadRequestException("Liên kết xác nhận không hợp lệ.");

        var tokenConsent = await _consentRepository.GetByTokenHashAsync(
            SubmissionConsentToken.Hash(request.Token), cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hoặc liên kết không hợp lệ.");
        EnsureIdentity(tokenConsent.Submission.Candidate.UserId, request.RequesterUserId);
        return tokenConsent;
    }

    private async Task MarkRaceAsDuplicateAsync(Guid submissionId, RespondSubmissionConsentCommand request, CancellationToken cancellationToken)
    {
        var current = await _consentRepository.GetBySubmissionIdAsync(submissionId, cancellationToken);
        if (current == null || current.Status != "PENDING") return;
        var winner = await _submissionRepository.GetAcceptedSubmissionAsync(
            current.Submission.CandidateId, current.Submission.JobId, cancellationToken);
        current.Submission.DuplicateOfSubmissionId = winner?.SubmissionId;
        await SetTerminalWithoutApplicationAsync(current, "CANCELLED", "BLOCKED_DUPLICATE", request, DateTime.UtcNow, cancellationToken);
    }

    private static void EnsureIdentity(Guid? candidateUserId, Guid? requesterUserId)
    {
        if (candidateUserId.HasValue && requesterUserId != candidateUserId)
            throw new ForbiddenException("Vui lòng đăng nhập đúng tài khoản Candidate để xác nhận hồ sơ.");
    }

    private static RespondSubmissionConsentResponse ExistingResponse(HRConnect.Domain.Entities.SubmissionConsent consent) => new()
    {
        Message = consent.Status == "CONFIRMED" ? "Yêu cầu đã được xác nhận trước đó." : "Yêu cầu đã được từ chối trước đó.",
        SubmissionId = consent.SubmissionId,
        SubmissionStatus = consent.Submission.Status,
        ApplicationId = consent.Submission.Applications.FirstOrDefault()?.ApplicationId,
        AiStatus = consent.Status == "CONFIRMED" ? "PENDING" : "NOT_QUEUED"
    };

    private static string? Limit(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Length <= max ? value : value[..max];

    private static bool IsAffiliateEligible(HRConnect.Domain.Entities.AffiliateProfile affiliate)
    {
        var profileIsEligible =
            string.Equals(affiliate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(affiliate.Status, "VERIFIED", StringComparison.OrdinalIgnoreCase);
        var user = affiliate.User;
        if (!profileIsEligible ||
            user == null ||
            !string.Equals(user.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return user.UserRoleUsers.Any(userRole =>
            string.Equals(userRole.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            userRole.Role.IsActive &&
            string.Equals(userRole.Role.Code, JobAccessPolicy.AffiliateRole, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsUniqueViolation(Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current.Message.Contains("23505", StringComparison.OrdinalIgnoreCase) ||
                current.Message.Contains("unique constraint", StringComparison.OrdinalIgnoreCase) ||
                current.Message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }
}
