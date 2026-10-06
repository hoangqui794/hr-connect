using FluentAssertions;
using HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;
using HRConnect.Application.Features.Candidates.Commands.ReplaceCandidateSkills;
using HRConnect.Application.Features.Candidates.Common;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class CandidateSkillValidatorsTests
{
    [Theory]
    [InlineData("BEGINNER")]
    [InlineData("intermediate")]
    [InlineData("ADVANCED")]
    [InlineData(" expert ")]
    public void AddValidator_AcceptsKnownProficiencyLevels(string proficiencyLevel)
    {
        var result = new AddCandidateSkillCommandValidator().Validate(new AddCandidateSkillCommand
        {
            SkillId = Guid.NewGuid(),
            ProficiencyLevel = proficiencyLevel,
            YearsOfExperience = 2
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void AddValidator_RejectsUnknownProficiencyLevel()
    {
        var result = new AddCandidateSkillCommandValidator().Validate(new AddCandidateSkillCommand
        {
            SkillId = Guid.NewGuid(),
            ProficiencyLevel = "MASTER"
        });

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void ReplaceValidator_RejectsDuplicateSkillIds()
    {
        var skillId = Guid.NewGuid();
        var result = new ReplaceCandidateSkillsCommandValidator().Validate(new ReplaceCandidateSkillsCommand
        {
            Skills =
            [
                new CandidateSkillInput(skillId, null, null),
                new CandidateSkillInput(skillId, "BEGINNER", 0)
            ]
        });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorMessage.Contains("trùng lặp"));
    }
}
