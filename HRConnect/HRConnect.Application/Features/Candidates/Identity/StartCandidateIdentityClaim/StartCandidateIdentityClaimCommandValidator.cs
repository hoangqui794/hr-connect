using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Identity.StartCandidateIdentityClaim;

public sealed class StartCandidateIdentityClaimCommandValidator
    : AbstractValidator<StartCandidateIdentityClaimCommand>
{
    public StartCandidateIdentityClaimCommandValidator()
    {
        RuleFor(command => command.Email)
            .NotEmpty().WithMessage("Email cần xác minh là bắt buộc.")
            .EmailAddress().WithMessage("Email không đúng định dạng.")
            .MaximumLength(255).WithMessage("Email không được vượt quá 255 ký tự.");
    }
}
