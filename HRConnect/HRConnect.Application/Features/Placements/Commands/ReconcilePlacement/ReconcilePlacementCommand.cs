using MediatR;

namespace HRConnect.Application.Features.Placements.Commands.ReconcilePlacement;

public sealed record ReconcilePlacementCommand(
    Guid ApplicationId,
    string Decision,
    string ContactChannel,
    string? Note,
    Guid? ConcurrencyToken,
    Guid ActorUserId) : IRequest<ReconcilePlacementResponse>;

public sealed record ReconcilePlacementResponse(
    Guid ReconciliationId,
    Guid ApplicationId,
    string Status,
    Guid ConcurrencyToken,
    DateTime ReviewedAt);
