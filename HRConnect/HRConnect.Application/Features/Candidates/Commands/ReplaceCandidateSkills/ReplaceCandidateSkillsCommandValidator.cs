using FluentValidation;
using HRConnect.Application.Features.Candidates.Common;

namespace HRConnect.Application.Features.Candidates.Commands.ReplaceCandidateSkills;

public sealed class ReplaceCandidateSkillsCommandValidator : AbstractValidator<ReplaceCandidateSkillsCommand>
{
    public ReplaceCandidateSkillsCommandValidator()
    {
        RuleFor(command => command.Skills)
            .NotNull().WithMessage("Danh sách kỹ năng không được để trống.")
            .Must(skills => skills is not null && skills.Count <= 50).WithMessage("Một hồ sơ chỉ được có tối đa 50 kỹ năng.")
            .Must(skills =>
            {
                if (skills is null) return true;
                var withIds = skills.Where(s => s.SkillId.HasValue && s.SkillId.Value != Guid.Empty).Select(s => s.SkillId!.Value).ToList();
                return withIds.Distinct().Count() == withIds.Count;
            })
            .WithMessage("Danh sách kỹ năng không được chứa SkillId trùng lặp.");

        RuleForEach(command => command.Skills).ChildRules(skill =>
        {
            skill.RuleFor(item => item)
                .Must(item => (item.SkillId.HasValue && item.SkillId.Value != Guid.Empty) || !string.IsNullOrWhiteSpace(item.SkillName))
                .WithMessage("Kỹ năng không được để trống.");
            skill.RuleFor(item => item.SkillName)
                .MaximumLength(120).WithMessage("Tên kỹ năng không được vượt quá 120 ký tự.")
                .When(item => !string.IsNullOrWhiteSpace(item.SkillName));
            skill.RuleFor(item => item.ProficiencyLevel)
                .Must(CandidateSkillRules.IsAllowedProficiencyLevel)
                .WithMessage("Mức thành thạo chỉ được là BEGINNER, INTERMEDIATE, ADVANCED hoặc EXPERT.");
            skill.RuleFor(item => item.YearsOfExperience)
                .InclusiveBetween(0, 80)
                .When(item => item.YearsOfExperience.HasValue)
                .WithMessage("Số năm kinh nghiệm phải từ 0 đến 80.");
        });
    }
}
