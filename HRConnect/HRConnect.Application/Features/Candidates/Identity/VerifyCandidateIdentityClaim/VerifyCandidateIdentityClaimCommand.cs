using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.VerifyCandidateIdentityClaim;

public sealed record VerifyCandidateIdentityClaimRequest(string Otp, Guid ConcurrencyToken);

public sealed record VerifyCandidateIdentityClaimCommand(
    Guid UserId,
    Guid ClaimId,
    string Otp,
    Guid ConcurrencyToken) : IRequest<VerifyCandidateIdentityClaimResponse>;

public sealed record VerifyCandidateIdentityClaimResponse(
    bool Success,
    string Message,
    Guid ClaimId,
    string Status,
    Guid? CandidateId,
    Guid ConcurrencyToken);
