using FluentValidation;

namespace HRConnect.Application.Features.Candidates.Commands.AdoptCandidateAffiliateCv;

public sealed class AdoptCandidateAffiliateCvCommandValidator
    : AbstractValidator<AdoptCandidateAffiliateCvCommand>
{
    public AdoptCandidateAffiliateCvCommandValidator()
    {
        RuleFor(command => command.UserId).NotEmpty();
        RuleFor(command => command.SourceCvId).NotEmpty();
        RuleFor(command => command.Title)
            .MaximumLength(180)
            .When(command => !string.IsNullOrWhiteSpace(command.Title))
            .WithMessage("Tên CV không được vượt quá 180 ký tự.");
    }
}
