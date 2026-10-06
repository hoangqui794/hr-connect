using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateAffiliateCvReuse;

public sealed class UpdateCandidateAffiliateCvReuseCommandHandler
    : IRequestHandler<UpdateCandidateAffiliateCvReuseCommand, UpdateCandidateAffiliateCvReuseResponse>
{
    private readonly ICandidateRepository _candidates;
    private readonly ICandidateCvRepository _candidateCvs;
    private readonly ISubmissionRepository _submissions;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public UpdateCandidateAffiliateCvReuseCommandHandler(
        ICandidateRepository candidates,
        ICandidateCvRepository candidateCvs,
        ISubmissionRepository submissions,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _candidates = candidates;
        _candidateCvs = candidateCvs;
        _submissions = submissions;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<UpdateCandidateAffiliateCvReuseResponse> Handle(
        UpdateCandidateAffiliateCvReuseCommand request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.");

        var detail = await _submissions.GetCandidateAffiliateCvDetailAsync(
            candidate.CandidateId, request.CvId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy CV do Affiliate đã nộp cho Candidate này.");

        var cv = await _candidateCvs.GetByCandidateIdAndCvIdAsync(
            candidate.CandidateId, request.CvId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy CV do Affiliate đã nộp cho Candidate này.");
        if (!string.Equals(cv.CreationMethod, "AFFILIATE_UPLOAD", StringComparison.Ordinal) ||
            string.Equals(cv.Status, "DELETED", StringComparison.Ordinal))
            throw new NotFoundException("Không tìm thấy CV do Affiliate đã nộp cho Candidate này.");

        if (request.ConcurrencyToken == Guid.Empty ||
            cv.AffiliateReuseConcurrencyToken != request.ConcurrencyToken)
            throw new ConflictException(
                "Quyền tái sử dụng CV vừa được thay đổi. Vui lòng tải lại dữ liệu và thử lại.",
                "CONCURRENT_UPDATE");

        if (request.Allowed && detail.AcceptedSubmissionCount == 0)
            throw new ConflictException(
                "Chỉ có thể cho phép tái sử dụng sau khi Candidate đã xác nhận ít nhất một lần nộp dùng CV này.",
                "CV_REUSE_NOT_ELIGIBLE");

        var currentStatus = cv.AffiliateReuseStatus ?? "NOT_GRANTED";
        var targetStatus = request.Allowed
            ? "ALLOWED"
            : currentStatus == "NOT_GRANTED" ? "NOT_GRANTED" : "REVOKED";

        if (currentStatus == targetStatus)
        {
            return Success(cv, targetStatus, "Quyền tái sử dụng CV không thay đổi.");
        }

        var now = DateTime.UtcNow;
        var previousToken = cv.AffiliateReuseConcurrencyToken;
        cv.AffiliateReuseStatus = targetStatus;
        cv.AffiliateReuseChangedAt = now;
        cv.AffiliateReuseChangedByUserId = request.UserId;
        cv.AffiliateReuseConcurrencyToken = Guid.NewGuid();
        cv.UpdatedAt = now;

        await _audit.AddAsync(new AuditEntry
        {
            Action = targetStatus == "ALLOWED"
                ? AuditActions.AffiliateCvReuseGranted
                : AuditActions.AffiliateCvReuseRevoked,
            EntityType = "CANDIDATE_CV",
            EntityId = cv.CvId,
            ActorUserId = request.UserId,
            OldValues = new
            {
                affiliateReuseStatus = currentStatus,
                reuseConcurrencyToken = previousToken
            },
            NewValues = new
            {
                affiliateReuseStatus = targetStatus,
                reuseConcurrencyToken = cv.AffiliateReuseConcurrencyToken,
                changedAt = now,
                candidate.CandidateId,
                detail.AffiliateUserId
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var message = targetStatus == "ALLOWED"
            ? "Đã cho phép Affiliate tái sử dụng CV cho các yêu cầu xác nhận mới."
            : "Đã thu hồi quyền Affiliate tái sử dụng CV cho các lần nộp mới.";
        return Success(cv, targetStatus, message);
    }

    private static UpdateCandidateAffiliateCvReuseResponse Success(
        Domain.Entities.CandidateCv cv,
        string status,
        string message) =>
        new(
            true,
            message,
            new CandidateAffiliateCvReuseData(
                cv.CvId,
                status,
                cv.AffiliateReuseConcurrencyToken,
                cv.AffiliateReuseChangedAt));
}
