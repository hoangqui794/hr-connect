namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateProfile;

public class CandidateProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy thông tin hồ sơ ứng viên thành công.";
    public CandidateProfileData? Data { get; set; }
}

public class CandidateProfileData
{
    public Guid CandidateId { get; set; }
    public Guid? UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? CurrentAddress { get; set; }
    public string? HighestEducation { get; set; }
    public decimal? YearsOfExperience { get; set; }
    public string? Summary { get; set; }
    public string ProfileVisibility { get; set; } = "PRIVATE";
    public string Status { get; set; } = "ACTIVE";
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<CandidateSkillItemDto> Skills { get; set; } = new();
    public CandidateCvItemDto? PrimaryCv { get; set; }
}

public class CandidateSkillItemDto
{
    public Guid SkillId { get; set; }
    public string SkillName { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? ProficiencyLevel { get; set; }
    public decimal? YearsOfExperience { get; set; }
}

public class CandidateCvItemDto
{
    public Guid CvId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string CreationMethod { get; set; } = string.Empty;
    public string? SourceFileUrl { get; set; }
    public string? RenderedFileUrl { get; set; }
    public string? FileName { get; set; }
    public long? FileSizeBytes { get; set; }
    public bool IsPrimary { get; set; }
    public DateTime UpdatedAt { get; set; }
}
