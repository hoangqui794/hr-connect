using System;
using System.Collections.Generic;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacements;

public record GetPlacementsResponse(
    IReadOnlyList<PlacementListItemDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages
);

public record PlacementListItemDto(
    Guid PlacementId,
    Guid ApplicationId,
    Guid OfferId,
    DateOnly ActualStartDate,
    string? Position,
    string? Department,
    string Status,
    DateTime ConfirmedAt,
    Guid? ConfirmedBy,
    string? ConfirmedByName,
    string? ConfirmationNote,
    PlacementCandidateDto Candidate,
    PlacementJobDto Job,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record PlacementCandidateDto(
    Guid CandidateId,
    string FullName,
    string Email,
    string? PhoneNumber
);

public record PlacementJobDto(
    Guid JobId,
    string Title,
    Guid CompanyId,
    string CompanyName
);
