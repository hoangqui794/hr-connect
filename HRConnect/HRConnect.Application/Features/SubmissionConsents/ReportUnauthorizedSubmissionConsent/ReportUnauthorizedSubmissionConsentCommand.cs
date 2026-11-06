using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.SubmissionConsents.Common;
using MediatR;

namespace HRConnect.Application.Features.SubmissionConsents.ReportUnauthorizedSubmissionConsent;

public sealed record ReportUnauthorizedSubmissionConsentCommand(
    string? Token,
    Guid? SubmissionId,
    Guid? RequesterUserId,
    string? Reason,
    string? IpAddress = null,
    string? UserAgent = null) : IRequest<ReportUnauthorizedSubmissionConsentResponse>;

public sealed record ReportUnauthorizedSubmissionConsentResponse(
    bool Success,
    string Message,
    Guid SubmissionId,
    string Status);

public sealed class ReportUnauthorizedSubmissionConsentCommandHandler(
    ISubmissionConsentRepository consentRepository,
    ISubmissionRepository submissionRepository,
    ICandidateCvRepository cvRepository,
    IAuditLogService audit,
    IUnitOfWork unitOfWork)
    : IRequestHandler<ReportUnauthorizedSubmissionConsentCommand, ReportUnauthorizedSubmissionConsentResponse>
{
    public async Task<ReportUnauthorizedSubmissionConsentResponse> Handle(
        ReportUnauthorizedSubmissionConsentCommand request,
        CancellationToken cancellationToken)
    {
        var consent = await ResolveConsentAsync(request, cancellationToken);
        var now = DateTime.UtcNow;
        var previousStatus = consent.Status;
        var reason = string.IsNullOrWhiteSpace(request.Reason)
            ? "Người nhận báo cáo không phải chủ hồ sơ hoặc chưa từng cho phép giới thiệu."
            : request.Reason.Trim();

        if (consent.Status == "PENDING")
        {
            consent.Status = "DECLINED";
            consent.RespondedAt = now;
            consent.UpdatedAt = now;
            consentRepository.Update(consent);

            if (consent.Submission.Status == "PENDING_CONSENT")
            {
                consent.Submission.Status = "CONSENT_REJECTED";
                consent.Submission.UpdatedAt = now;
                submissionRepository.Update(consent.Submission);
            }

            if (consent.Submission.CandidateCv.CreationMethod == "AFFILIATE_UPLOAD")
            {
                consent.Submission.CandidateCv.AffiliateReuseStatus = "REVOKED";
                consent.Submission.CandidateCv.AffiliateReuseChangedAt = now;
                consent.Submission.CandidateCv.AffiliateReuseConcurrencyToken = Guid.NewGuid();
                if (consent.Submission.CandidateCv.Status == "PENDING_CONSENT")
                    consent.Submission.CandidateCv.Status = "ARCHIVED";
                consent.Submission.CandidateCv.UpdatedAt = now;
                cvRepository.Update(consent.Submission.CandidateCv);
            }
        }

        await audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.SubmissionConsentUnauthorizedReported,
            EntityType = "SUBMISSION_CONSENT",
            EntityId = consent.ConsentId,
            ActorUserId = request.RequesterUserId,
            CorrelationId = consent.SubmissionId,
            OldValues = new { status = previousStatus },
            NewValues = new
            {
                consent.SubmissionId,
                consent.Submission.CandidateId,
                affiliateUserId = consent.Submission.SubmittedBy,
                status = consent.Status,
                reason,
                ipAddress = request.IpAddress,
                userAgent = request.UserAgent
            }
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new ReportUnauthorizedSubmissionConsentResponse(
            true,
            "Đã ghi nhận báo cáo của bạn và chặn việc sử dụng hồ sơ này.",
            consent.SubmissionId,
            consent.Status);
    }

    private async Task<HRConnect.Domain.Entities.SubmissionConsent> ResolveConsentAsync(
        ReportUnauthorizedSubmissionConsentCommand request,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(request.Token))
        {
            var tokenConsent = await consentRepository.GetByTokenHashAsync(
                SubmissionConsentToken.Hash(request.Token),
                cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hoặc liên kết không hợp lệ.");
            return tokenConsent;
        }

        if (request.SubmissionId.HasValue)
        {
            if (!request.RequesterUserId.HasValue)
                throw new ForbiddenException("Vui lòng đăng nhập tài khoản Candidate để thực hiện báo cáo.");

            var consent = await consentRepository.GetBySubmissionIdAsync(request.SubmissionId.Value, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy yêu cầu xác nhận hồ sơ.");
            if (consent.Submission.Candidate.UserId != request.RequesterUserId)
                throw new ForbiddenException("Bạn không có quyền báo cáo trên yêu cầu của Candidate khác.");
            return consent;
        }

        throw new BadRequestException("Thiếu thông tin liên kết hoặc mã yêu cầu xác nhận.");
    }
}
