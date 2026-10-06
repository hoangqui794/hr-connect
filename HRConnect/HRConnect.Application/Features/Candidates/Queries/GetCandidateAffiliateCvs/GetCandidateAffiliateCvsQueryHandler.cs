using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvs;

public sealed class GetCandidateAffiliateCvsQueryHandler
    : IRequestHandler<GetCandidateAffiliateCvsQuery, GetCandidateAffiliateCvsResponse>
{
    private readonly ICandidateRepository _candidates;
    private readonly ISubmissionRepository _submissions;

    public GetCandidateAffiliateCvsQueryHandler(
        ICandidateRepository candidates,
        ISubmissionRepository submissions)
    {
        _candidates = candidates;
        _submissions = submissions;
    }

    public async Task<GetCandidateAffiliateCvsResponse> Handle(
        GetCandidateAffiliateCvsQuery request,
        CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ Candidate của tài khoản hiện tại.");
        if (!string.Equals(candidate.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
            candidate.MergedIntoCandidateId.HasValue)
            throw new ConflictException("Hồ sơ Candidate đã bị khóa, lưu trữ hoặc hợp nhất.");

        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize <= 0 ? 20 : request.PageSize, 1, 100);
        var (items, totalCount) = await _submissions.GetCandidateAffiliateCvsAsync(
            candidate.CandidateId, page, pageSize, cancellationToken);

        return new GetCandidateAffiliateCvsResponse(
            true,
            new CandidateAffiliateCvListData(
                items.Select(item => new CandidateAffiliateCvItem(
                    item.CvId,
                    item.Title,
                    item.FileName,
                    item.MimeType,
                    item.FileSizeBytes,
                    item.DocumentStatus,
                    item.AffiliateReuseStatus,
                    item.ReuseConcurrencyToken,
                    item.AffiliateUserId,
                    item.AffiliateDisplayName,
                    item.SubmissionCount,
                    item.PendingConsentCount,
                    item.AcceptedSubmissionCount,
                    item.LastSubmittedAt,
                    item.CreatedAt)).ToList(),
                new CandidateAffiliateCvPagination(
                    page,
                    pageSize,
                    totalCount,
                    (int)Math.Ceiling(totalCount / (double)pageSize))));
    }
}
