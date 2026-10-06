using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDetail;

public sealed class GetCandidateAffiliateCvDetailQueryHandler
    : IRequestHandler<GetCandidateAffiliateCvDetailQuery, GetCandidateAffiliateCvDetailResponse>
{
    private readonly ICandidateRepository _candidates;
    private readonly ISubmissionRepository _submissions;

    public GetCandidateAffiliateCvDetailQueryHandler(
        ICandidateRepository candidates,
        ISubmissionRepository submissions)
    {
        _candidates = candidates;
        _submissions = submissions;
    }

    public async Task<GetCandidateAffiliateCvDetailResponse> Handle(
        GetCandidateAffiliateCvDetailQuery request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.");

        var cv = await _submissions.GetCandidateAffiliateCvDetailAsync(
            candidate.CandidateId, request.CvId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy CV do Affiliate đã nộp cho Candidate này.");

        return new GetCandidateAffiliateCvDetailResponse(
            true,
            new CandidateAffiliateCvDetailData(
                cv.CvId,
                cv.Title,
                cv.FileName,
                cv.MimeType,
                cv.FileSizeBytes,
                cv.DocumentStatus,
                cv.AffiliateReuseStatus,
                cv.ReuseConcurrencyToken,
                cv.ReuseChangedAt,
                cv.AffiliateUserId,
                cv.AffiliateDisplayName,
                cv.SubmissionCount,
                cv.PendingConsentCount,
                cv.AcceptedSubmissionCount,
                cv.DeclinedSubmissionCount,
                cv.ExpiredSubmissionCount,
                cv.LastSubmittedAt,
                cv.CreatedAt,
                cv.UpdatedAt));
    }
}
