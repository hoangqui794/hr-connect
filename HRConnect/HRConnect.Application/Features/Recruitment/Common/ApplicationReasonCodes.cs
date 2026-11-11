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
    public const string CandidateAcceptedOtherJob = "CANDIDATE_ACCEPTED_OTHER_JOB";
    public const string CandidatePersonalReason = "CANDIDATE_PERSONAL_REASON";
    public const string CandidateNoShow = "CANDIDATE_NO_SHOW";
    public const string CandidateOther = "CANDIDATE_OTHER";
    public const string EmployerCancelled = "EMPLOYER_CANCELLED";

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

    public static readonly string[] NotStartedCodes =
    [
        CandidateAcceptedOtherJob,
        CandidatePersonalReason,
        CandidateNoShow,
        CandidateUnreachable,
        EmployerCancelled,
        CandidateOther
    ];

    public static string GetNotStartedLabel(string reasonCode) => reasonCode switch
    {
        CandidateAcceptedOtherJob => "Ứng viên báo đã nhận việc ở nơi khác.",
        CandidatePersonalReason => "Ứng viên báo lý do cá nhân, sức khỏe hoặc gia đình.",
        CandidateNoShow => "Ứng viên không đến vào ngày hẹn.",
        CandidateUnreachable => "Không liên hệ được ứng viên.",
        EmployerCancelled => "Doanh nghiệp dừng tiếp nhận vị trí này.",
        _ => "Ứng viên không nhận việc."
    };

    public static string? Normalize(string? code) =>
        string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();
}
