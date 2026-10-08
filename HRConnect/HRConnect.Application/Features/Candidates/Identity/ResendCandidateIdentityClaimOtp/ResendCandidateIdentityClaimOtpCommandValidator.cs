using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Identity.ResendCandidateIdentityClaimOtp;

public sealed class ResendCandidateIdentityClaimOtpCommandValidator
    : AbstractValidator<ResendCandidateIdentityClaimOtpCommand>
{
    public ResendCandidateIdentityClaimOtpCommandValidator()
    {
        RuleFor(command => command.ClaimId)
            .NotEmpty().WithMessage("Mã yêu cầu xác minh là bắt buộc.");
        RuleFor(command => command.ConcurrencyToken)
            .NotEmpty().WithMessage("Concurrency token là bắt buộc.");
    }
}
