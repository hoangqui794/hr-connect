using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.RevokeCandidateEmailIdentity;

public sealed record RevokeCandidateEmailIdentityCommand(
    Guid UserId,
    Guid EmailIdentityId,
    Guid ConcurrencyToken) : IRequest<RevokeCandidateEmailIdentityResponse>;

public sealed record RevokeCandidateEmailIdentityResponse(
    bool Success,
    Guid EmailIdentityId,
    string Status,
    DateTime RevokedAt,
    Guid ConcurrencyToken);
