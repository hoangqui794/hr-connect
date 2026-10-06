using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvUsages;

public sealed class GetCandidateAffiliateCvUsagesQueryHandler
    : IRequestHandler<GetCandidateAffiliateCvUsagesQuery, GetCandidateAffiliateCvUsagesResponse>
{
    private readonly ICandidateRepository _candidates;
    private readonly ISubmissionRepository _submissions;

    public GetCandidateAffiliateCvUsagesQueryHandler(
        ICandidateRepository candidates,
        ISubmissionRepository submissions)
    {
        _candidates = candidates;
        _submissions = submissions;
    }

    public async Task<GetCandidateAffiliateCvUsagesResponse> Handle(
        GetCandidateAffiliateCvUsagesQuery request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.");

        if (await _submissions.GetCandidateAffiliateCvDetailAsync(
                candidate.CandidateId, request.CvId, cancellationToken) == null)
            throw new NotFoundException("Không tìm thấy CV do Affiliate đã nộp cho Candidate này.");

        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize <= 0 ? 20 : request.PageSize, 1, 100);
        var (items, totalCount) = await _submissions.GetCandidateAffiliateCvUsagesAsync(
            candidate.CandidateId, request.CvId, page, pageSize, cancellationToken);

        return new GetCandidateAffiliateCvUsagesResponse(
            true,
            new CandidateAffiliateCvUsageListData(
                request.CvId,
                items.Select(item => new CandidateAffiliateCvUsageItem(
                    item.SubmissionId,
                    item.JobId,
                    item.JobTitle,
                    item.CompanyId,
                    item.CompanyName,
                    item.AffiliateUserId,
                    item.AffiliateDisplayName,
                    item.SubmissionStatus,
                    item.SubmittedAt,
                    item.ConsentStatus,
                    item.ConsentRequestedAt,
                    item.ConsentExpiresAt,
                    item.ConsentRespondedAt,
                    item.ApplicationId,
                    item.ApplicationStatus,
                    item.ApplicationCurrentStage,
                    item.AiStatus,
                    item.AiMatchScore,
                    item.AiMatchTier,
                    item.AiCompletedAt)).ToList(),
                new CandidateAffiliateCvUsagePagination(
                    page,
                    pageSize,
                    totalCount,
                    (int)Math.Ceiling(totalCount / (double)pageSize))));
    }
}
