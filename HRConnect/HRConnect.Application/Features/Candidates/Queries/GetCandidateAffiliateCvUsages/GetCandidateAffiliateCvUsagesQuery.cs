using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvUsages;

public sealed record GetCandidateAffiliateCvUsagesQuery(
    Guid UserId,
    Guid CvId,
    int Page = 1,
    int PageSize = 20) : IRequest<GetCandidateAffiliateCvUsagesResponse>;

public sealed record GetCandidateAffiliateCvUsagesResponse(
    bool Success,
    CandidateAffiliateCvUsageListData Data);

public sealed record CandidateAffiliateCvUsageListData(
    Guid CvId,
    IReadOnlyList<CandidateAffiliateCvUsageItem> Items,
    CandidateAffiliateCvUsagePagination Pagination);

public sealed record CandidateAffiliateCvUsageItem(
    Guid SubmissionId,
    Guid JobId,
    string JobTitle,
    Guid CompanyId,
    string CompanyName,
    Guid AffiliateUserId,
    string AffiliateDisplayName,
    string SubmissionStatus,
    DateTime SubmittedAt,
    string? ConsentStatus,
    DateTime? ConsentRequestedAt,
    DateTime? ConsentExpiresAt,
    DateTime? ConsentRespondedAt,
    Guid? ApplicationId,
    string? ApplicationStatus,
    string? ApplicationCurrentStage,
    string? AiStatus,
    decimal? AiMatchScore,
    string? AiMatchTier,
    DateTime? AiCompletedAt);

public sealed record CandidateAffiliateCvUsagePagination(
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);
