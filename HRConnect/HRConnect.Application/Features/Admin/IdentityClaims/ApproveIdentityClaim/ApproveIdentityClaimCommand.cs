using FluentValidation;
using MediatR;

namespace HRConnect.Application.Features.Admin.IdentityClaims.ApproveIdentityClaim;

public sealed record ApproveIdentityClaimRequest(
    Guid ConcurrencyToken,
    string? Note);

public sealed record ApproveIdentityClaimCommand(
    Guid ClaimId,
    Guid AdminUserId,
    Guid ConcurrencyToken,
    string? Note) : IRequest<ApproveIdentityClaimResponse>;

public sealed record ApproveIdentityClaimResponse(
    bool Success,
    string Message,
    Guid ClaimId,
    string Status,
    Guid CanonicalCandidateId,
    Guid ConcurrencyToken);

public sealed class ApproveIdentityClaimCommandValidator
    : AbstractValidator<ApproveIdentityClaimCommand>
{
    public ApproveIdentityClaimCommandValidator()
    {
        RuleFor(x => x.ClaimId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
        RuleFor(x => x.ConcurrencyToken)
            .NotEmpty()
            .WithMessage("Concurrency token là bắt buộc.");
        RuleFor(x => x.Note)
            .MaximumLength(1000)
            .WithMessage("Ghi chú không được vượt quá 1000 ký tự.");
    }
}
