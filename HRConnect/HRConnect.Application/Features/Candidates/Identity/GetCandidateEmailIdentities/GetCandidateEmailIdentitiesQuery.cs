using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.GetCandidateEmailIdentities;

public sealed record GetCandidateEmailIdentitiesQuery(Guid UserId)
    : IRequest<GetCandidateEmailIdentitiesResponse>;

public sealed record GetCandidateEmailIdentitiesResponse(
    bool Success,
    string Message,
    CandidateEmailIdentitiesData Data);

public sealed record CandidateEmailIdentitiesData(
    IReadOnlyList<CandidateEmailIdentityItem> Items);

public sealed record CandidateEmailIdentityItem(
    Guid EmailIdentityId,
    string Email,
    string Kind,
    string Status,
    string VerificationSource,
    DateTime? VerifiedAt,
    DateTime? RevokedAt,
    DateTime CreatedAt,
    Guid ConcurrencyToken,
    bool CanRevoke,
    bool CanMakePrimary);
