using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateCandidateLibrary;

public sealed class GetAffiliateCandidateLibraryQueryHandler
    : IRequestHandler<GetAffiliateCandidateLibraryQuery, GetAffiliateCandidateLibraryResponse>
{
    private static readonly HashSet<string> AllowedSortFields =
        new(StringComparer.OrdinalIgnoreCase) { "lastSubmittedAt", "candidateName" };

    private readonly IAffiliateProfileRepository _affiliateProfiles;
    private readonly ISubmissionRepository _submissions;

    public GetAffiliateCandidateLibraryQueryHandler(
        IAffiliateProfileRepository affiliateProfiles,
        ISubmissionRepository submissions)
    {
        _affiliateProfiles = affiliateProfiles;
        _submissions = submissions;
    }

    public async Task<GetAffiliateCandidateLibraryResponse> Handle(
        GetAffiliateCandidateLibraryQuery request,
        CancellationToken cancellationToken)
    {
        if (await _affiliateProfiles.GetByUserIdAsync(request.UserId, cancellationToken) == null)
            throw new ForbiddenException("Không tìm thấy hồ sơ Affiliate Recruiter của bạn.");

        var search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim();
        if (search?.Length > 100)
            throw new BadRequestException("Từ khóa tìm kiếm không được vượt quá 100 ký tự.");

        var sortBy = string.IsNullOrWhiteSpace(request.SortBy) ? "lastSubmittedAt" : request.SortBy.Trim();
        if (!AllowedSortFields.Contains(sortBy))
            throw new BadRequestException("sortBy chỉ nhận lastSubmittedAt hoặc candidateName.");

        var sortDirection = string.IsNullOrWhiteSpace(request.SortDirection)
            ? "desc"
            : request.SortDirection.Trim().ToLowerInvariant();
        if (sortDirection is not ("asc" or "desc"))
            throw new BadRequestException("sortDirection chỉ nhận asc hoặc desc.");

        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize <= 0 ? 20 : request.PageSize, 1, 100);
        var (items, totalCount) = await _submissions.GetAffiliateCandidateLibraryAsync(
            request.UserId, search, sortBy, sortDirection, page, pageSize, cancellationToken);

        return new GetAffiliateCandidateLibraryResponse
        {
            Data = new AffiliateCandidateLibraryData
            {
                Items = items.Select(item => new AffiliateCandidateLibraryItemDto(
                    item.CandidateId,
                    item.FullName,
                    item.Email,
                    item.Phone,
                    item.HasAccount,
                    item.ActiveCvCount,
                    item.AcceptedSubmissionCount,
                    item.LastSubmittedAt)).ToList(),
                Pagination = new PaginationDto(
                    page,
                    pageSize,
                    totalCount,
                    (int)Math.Ceiling(totalCount / (double)pageSize))
            }
        };
    }
}
