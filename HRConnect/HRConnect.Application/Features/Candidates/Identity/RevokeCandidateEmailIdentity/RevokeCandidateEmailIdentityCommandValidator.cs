using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Identity.RevokeCandidateEmailIdentity;

public sealed class RevokeCandidateEmailIdentityCommandValidator : AbstractValidator<RevokeCandidateEmailIdentityCommand>
{
    public RevokeCandidateEmailIdentityCommandValidator()
    {
        RuleFor(command => command.UserId).NotEmpty();
        RuleFor(command => command.EmailIdentityId).NotEmpty();
        RuleFor(command => command.ConcurrencyToken).NotEmpty();
    }
}
