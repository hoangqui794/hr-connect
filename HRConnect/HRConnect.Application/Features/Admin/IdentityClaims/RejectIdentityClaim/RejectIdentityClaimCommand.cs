using FluentValidation;
using MediatR;

namespace HRConnect.Application.Features.Admin.IdentityClaims.RejectIdentityClaim;

public sealed record RejectIdentityClaimRequest(
    Guid ConcurrencyToken,
    string Reason);

public sealed record RejectIdentityClaimCommand(
    Guid ClaimId,
    Guid AdminUserId,
    Guid ConcurrencyToken,
    string Reason) : IRequest<RejectIdentityClaimResponse>;

public sealed record RejectIdentityClaimResponse(
    bool Success,
    string Message,
    Guid ClaimId,
    string Status,
    Guid ConcurrencyToken);

public sealed class RejectIdentityClaimCommandValidator
    : AbstractValidator<RejectIdentityClaimCommand>
{
    public RejectIdentityClaimCommandValidator()
    {
        RuleFor(x => x.ClaimId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
        RuleFor(x => x.ConcurrencyToken)
            .NotEmpty()
            .WithMessage("Concurrency token là bắt buộc.");
        RuleFor(x => x.Reason)
            .NotEmpty()
            .WithMessage("Lý do từ chối là bắt buộc.")
            .MaximumLength(1000)
            .WithMessage("Lý do từ chối không được vượt quá 1000 ký tự.");
    }
}
