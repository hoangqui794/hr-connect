using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.StartCandidateIdentityClaim;

public sealed record StartCandidateIdentityClaimRequest(string Email);

public sealed record StartCandidateIdentityClaimCommand(
    Guid UserId,
    string Email) : IRequest<StartCandidateIdentityClaimResponse>;

public sealed record StartCandidateIdentityClaimResponse(
    bool Success,
    string Message,
    StartCandidateIdentityClaimData Data);

public sealed record StartCandidateIdentityClaimData(
    Guid ClaimId,
    string MaskedDestination,
    DateTime ExpiresAt,
    DateTime ResendAfter);
