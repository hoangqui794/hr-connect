using System;
using MediatR;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacementDetail;

public record GetPlacementDetailQuery(
    Guid PlacementId,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false,
    bool IsCandidate = false
) : IRequest<GetPlacementDetailResponse>;
