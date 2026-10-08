using MediatR;

namespace HRConnect.Application.Features.Candidates.Identity.ResendCandidateIdentityClaimOtp;

public sealed record ResendCandidateIdentityClaimOtpRequest(Guid ConcurrencyToken);

public sealed record ResendCandidateIdentityClaimOtpCommand(
    Guid UserId,
    Guid ClaimId,
    Guid ConcurrencyToken) : IRequest<ResendCandidateIdentityClaimOtpResponse>;

public sealed record ResendCandidateIdentityClaimOtpResponse(
    bool Success,
    string Message,
    Guid ClaimId,
    string MaskedDestination,
    DateTime ExpiresAt,
    DateTime ResendAfter,
    int ResendCount,
    string EmailDeliveryStatus,
    Guid ConcurrencyToken);
