using MediatR;

namespace HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;

public sealed record ResolveFlaggedReconciliationCommand(
    Guid ApplicationId,
    string? Action,
    string Note,
    Guid? ConcurrencyToken,
    Guid ActorUserId) : IRequest<ResolveFlaggedReconciliationResponse>;

public sealed record ResolveFlaggedReconciliationResponse(
    Guid ReconciliationId,
    Guid ApplicationId,
    string Status,
    string ResolutionAction,
    string ApplicationStatus,
    Guid ConcurrencyToken,
    DateTime ReviewedAt);
