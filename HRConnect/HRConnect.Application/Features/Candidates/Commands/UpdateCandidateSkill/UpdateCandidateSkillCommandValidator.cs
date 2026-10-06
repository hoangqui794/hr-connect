using FluentValidation;
using HRConnect.Application.Features.Candidates.Common;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateSkill;

public sealed class UpdateCandidateSkillCommandValidator : AbstractValidator<UpdateCandidateSkillCommand>
{
    public UpdateCandidateSkillCommandValidator()
    {
        RuleFor(command => command.ProficiencyLevel)
            .Must(CandidateSkillRules.IsAllowedProficiencyLevel)
            .WithMessage("Mức thành thạo chỉ được là BEGINNER, INTERMEDIATE, ADVANCED hoặc EXPERT.");
        RuleFor(command => command.YearsOfExperience)
            .InclusiveBetween(0, 80)
            .When(command => command.YearsOfExperience.HasValue)
            .WithMessage("Số năm kinh nghiệm phải từ 0 đến 80.");
    }
}
