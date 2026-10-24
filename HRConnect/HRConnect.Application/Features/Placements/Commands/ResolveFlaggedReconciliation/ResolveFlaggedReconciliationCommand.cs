using MediatR;

namespace HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;

public sealed record ResolveFlaggedReconciliationCommand(
    Guid ApplicationId,
    string Note,
    Guid? ConcurrencyToken,
    Guid ActorUserId) : IRequest<ResolveFlaggedReconciliationResponse>;

public sealed record ResolveFlaggedReconciliationResponse(
    Guid ReconciliationId,
    Guid ApplicationId,
    string Status,
    Guid ConcurrencyToken,
    DateTime ReviewedAt);
