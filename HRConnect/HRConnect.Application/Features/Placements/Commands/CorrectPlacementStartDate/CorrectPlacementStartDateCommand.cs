using MediatR;

namespace HRConnect.Application.Features.Placements.Commands.CorrectPlacementStartDate;

/// <summary>
/// Exceptional correction of an already-confirmed start date. The normal MF-04
/// actor remains Client Company; this repair action is reserved for Internal HR/Admin.
/// </summary>
public record CorrectPlacementStartDateCommand(
    Guid PlacementId,
    DateOnly ActualStartDate,
    string Reason,
    Guid CurrentUserId,
    bool IsInternalHrOrAdmin = false
) : IRequest<CorrectPlacementStartDateResponse>;
