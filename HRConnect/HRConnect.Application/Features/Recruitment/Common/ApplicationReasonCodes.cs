namespace HRConnect.Application.Features.Recruitment.Common;

/// <summary>
/// Structured reasons for application decisions (MF-03). Mirrors JobReasonCodes: a code is
/// required, the free-text note is optional except for OTHER.
/// </summary>
public static class ApplicationReasonCodes
{
    public const string SkillMismatch = "SKILL_MISMATCH";
    public const string InsufficientExperience = "INSUFFICIENT_EXPERIENCE";
    public const string SalaryMismatch = "SALARY_MISMATCH";
    public const string LocationMismatch = "LOCATION_MISMATCH";
    public const string LanguageRequirement = "LANGUAGE_REQUIREMENT";
    public const string CandidateUnreachable = "CANDIDATE_UNREACHABLE";
    public const string PositionFilled = "POSITION_FILLED";
    public const string Other = "OTHER";

    public static readonly string[] ScreeningRejectionCodes =
    [
        SkillMismatch,
        InsufficientExperience,
        SalaryMismatch,
        LocationMismatch,
        LanguageRequirement,
        CandidateUnreachable,
        PositionFilled,
        Other
    ];

    public const int MaxNoteLength = 2000;

    public static string? Normalize(string? code) =>
        string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();
}
