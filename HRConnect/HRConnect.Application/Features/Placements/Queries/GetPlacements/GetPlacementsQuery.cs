using System;
using MediatR;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacements;

public record GetPlacementsQuery(
    Guid CurrentUserId,
    Guid? CompanyId = null,
    Guid? JobId = null,
    Guid? CandidateId = null,
    string? Status = null,
    DateOnly? FromDate = null,
    DateOnly? ToDate = null,
    int Page = 1,
    int PageSize = 10,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<GetPlacementsResponse>;
