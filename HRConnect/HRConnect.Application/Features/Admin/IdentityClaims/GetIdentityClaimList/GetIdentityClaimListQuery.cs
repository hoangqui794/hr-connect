using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.IdentityClaims.GetIdentityClaimList;

public sealed record GetIdentityClaimListQuery(
    string Status = "PENDING_ADMIN_REVIEW",
    string? Search = null,
    int Page = 1,
    int PageSize = 20,
    string SortBy = "createdAt",
    string SortDirection = "desc") : IRequest<GetIdentityClaimListResponse>;

public sealed record AdminIdentityClaimListItem(
    Guid ClaimId,
    Guid RequesterUserId,
    Guid RequesterCandidateId,
    Guid? TargetCandidateId,
    string MaskedAssertedEmail,
    string Status,
    string? ReviewReason,
    string RequesterDisplayName,
    string RequesterPrimaryEmail,
    string RequesterCandidateName,
    string? TargetCandidateName,
    DateTime CreatedAt,
    DateTime? VerifiedAt,
    DateTime? ReviewedAt,
    Guid? ReviewedBy);

public sealed record GetIdentityClaimListData(
    IReadOnlyList<AdminIdentityClaimListItem> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages);

public sealed record GetIdentityClaimListResponse(
    bool Success,
    GetIdentityClaimListData Data);

public sealed class GetIdentityClaimListQueryHandler(
    ICandidateIdentityClaimRepository claims)
    : IRequestHandler<GetIdentityClaimListQuery, GetIdentityClaimListResponse>
{
    public async Task<GetIdentityClaimListResponse> Handle(
        GetIdentityClaimListQuery request,
        CancellationToken cancellationToken)
    {
        var status = request.Status.Trim().ToUpperInvariant();
        var sortBy = NormalizeSortBy(request.SortBy);
        var descending = string.Equals(request.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);
        var (records, total) = await claims.GetAdminListAsync(
            status,
            string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim(),
            request.Page,
            request.PageSize,
            sortBy,
            descending,
            cancellationToken);

        var items = records.Select(record => new AdminIdentityClaimListItem(
            record.ClaimId,
            record.RequesterUserId,
            record.RequesterCandidateId,
            record.TargetCandidateId,
            MaskEmail(record.NormalizedEmail),
            record.Status,
            record.ReviewReason,
            record.RequesterDisplayName,
            record.RequesterPrimaryEmail,
            record.RequesterCandidateName,
            record.TargetCandidateName,
            record.CreatedAt,
            record.VerifiedAt,
            record.ReviewedAt,
            record.ReviewedBy)).ToArray();

        return new GetIdentityClaimListResponse(
            true,
            new GetIdentityClaimListData(
                items,
                request.Page,
                request.PageSize,
                total,
                (int)Math.Ceiling((double)total / request.PageSize)));
    }

    private static string NormalizeSortBy(string sortBy) => sortBy.Trim().ToLowerInvariant() switch
    {
        "verifiedat" => "verifiedAt",
        "reviewedat" => "reviewedAt",
        _ => "createdAt"
    };

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "***";
        var local = email[..at];
        return $"{local[..Math.Min(2, local.Length)]}***{email[at..]}";
    }
}
