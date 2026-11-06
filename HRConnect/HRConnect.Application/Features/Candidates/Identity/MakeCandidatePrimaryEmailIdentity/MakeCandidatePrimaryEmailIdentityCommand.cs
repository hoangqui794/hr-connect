using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.MakeCandidatePrimaryEmailIdentity;

public sealed record MakeCandidatePrimaryEmailIdentityCommand(
    Guid UserId,
    Guid EmailIdentityId,
    Guid? ConcurrencyToken = null) : IRequest<MakeCandidatePrimaryEmailIdentityResponse>;

public sealed record MakeCandidatePrimaryEmailIdentityResponse(
    bool Success,
    string Message,
    Guid EmailIdentityId,
    string Email,
    string Kind,
    string Status,
    Guid ConcurrencyToken);

