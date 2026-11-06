using FluentValidation;
using HRConnect.Application.Features.Candidates.Common;

namespace HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;

public sealed class AddCandidateSkillCommandValidator : AbstractValidator<AddCandidateSkillCommand>
{
    public AddCandidateSkillCommandValidator()
    {
        RuleFor(command => command)
            .Must(command => (command.SkillId.HasValue && command.SkillId.Value != Guid.Empty) || !string.IsNullOrWhiteSpace(command.SkillName))
            .WithMessage("Kỹ năng không được để trống.");

        RuleFor(command => command.SkillName)
            .MaximumLength(120).WithMessage("Tên kỹ năng không được vượt quá 120 ký tự.")
            .When(command => !string.IsNullOrWhiteSpace(command.SkillName));

        RuleFor(command => command.ProficiencyLevel)
            .Must(CandidateSkillRules.IsAllowedProficiencyLevel)
            .WithMessage("Mức thành thạo chỉ được là BEGINNER, INTERMEDIATE, ADVANCED hoặc EXPERT.");

        RuleFor(command => command.YearsOfExperience)
            .InclusiveBetween(0, 80)
            .When(command => command.YearsOfExperience.HasValue)
            .WithMessage("Số năm kinh nghiệm phải từ 0 đến 80.");
    }
}
