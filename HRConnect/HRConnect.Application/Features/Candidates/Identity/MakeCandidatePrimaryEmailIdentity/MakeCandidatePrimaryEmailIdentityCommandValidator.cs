using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Identity.MakeCandidatePrimaryEmailIdentity;

public sealed class MakeCandidatePrimaryEmailIdentityCommandValidator : AbstractValidator<MakeCandidatePrimaryEmailIdentityCommand>
{
    public MakeCandidatePrimaryEmailIdentityCommandValidator()
    {
        RuleFor(command => command.UserId).NotEmpty();
        RuleFor(command => command.EmailIdentityId).NotEmpty();
    }
}

