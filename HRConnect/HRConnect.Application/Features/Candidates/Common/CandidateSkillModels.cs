using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Candidates.Common;

public sealed record CandidateSkillDto(
    Guid SkillId,
    string SkillName,
    string? Category,
    string? ProficiencyLevel,
    decimal? YearsOfExperience);

public sealed record CandidateSkillInput(
    Guid SkillId,
    string? ProficiencyLevel,
    decimal? YearsOfExperience);

public static class CandidateSkillRules
{
    private static readonly HashSet<string> AllowedProficiencyLevels = new(StringComparer.Ordinal)
    {
        "BEGINNER",
        "INTERMEDIATE",
        "ADVANCED",
        "EXPERT"
    };

    public static bool IsAllowedProficiencyLevel(string? value) =>
        string.IsNullOrWhiteSpace(value) || AllowedProficiencyLevels.Contains(value.Trim().ToUpperInvariant());

    public static string? NormalizeProficiencyLevel(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

    public static CandidateSkillDto ToDto(CandidateSkill candidateSkill) => new(
        candidateSkill.SkillId,
        candidateSkill.Skill?.SkillName ?? string.Empty,
        candidateSkill.Skill?.Category,
        candidateSkill.ProficiencyLevel,
        candidateSkill.YearsOfExperience);

    public static CandidateSkillDto ToDto(CandidateSkill candidateSkill, Skill skill) => new(
        candidateSkill.SkillId,
        skill.SkillName,
        skill.Category,
        candidateSkill.ProficiencyLevel,
        candidateSkill.YearsOfExperience);
}
