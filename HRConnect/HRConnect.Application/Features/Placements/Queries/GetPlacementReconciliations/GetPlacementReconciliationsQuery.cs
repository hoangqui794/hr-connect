using MediatR;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacementReconciliations;

public sealed record GetPlacementReconciliationsQuery(string? Status, int Page = 1, int PageSize = 20)
    : IRequest<GetPlacementReconciliationsResponse>;

public sealed record PlacementReconciliationListItem(
    Guid ReconciliationId,
    Guid ApplicationId,
    Guid? PlacementId,
    string JobTitle,
    string CompanyName,
    string CandidateName,
    string? CandidateEmail,
    string? AffiliateName,
    string ClaimedOutcome,
    DateOnly? ActualStartDate,
    decimal? ServiceFeeAmount,
    string? ServiceFeeCurrency,
    string Status,
    string? ContactChannel,
    string? Note,
    string? ResolutionNote,
    Guid ConcurrencyToken,
    DateTime CreatedAt,
    DateTime? ReviewedAt);

public sealed record GetPlacementReconciliationsResponse(
    IReadOnlyList<PlacementReconciliationListItem> Items,
    int TotalCount,
    int Page,
    int PageSize);
