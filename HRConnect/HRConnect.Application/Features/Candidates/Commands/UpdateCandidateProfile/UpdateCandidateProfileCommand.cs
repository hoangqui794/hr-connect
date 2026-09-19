using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateProfile;

public class UpdateCandidateProfileCommand : IRequest<UpdateCandidateProfileResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string? Phone { get; set; }

    public DateOnly? DateOfBirth { get; set; }

    public string? Gender { get; set; }

    public string? CurrentAddress { get; set; }

    public string? HighestEducation { get; set; }

    public decimal? YearsOfExperience { get; set; }

    public string? Summary { get; set; }
}

public class UpdateCandidateProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật hồ sơ ứng viên thành công.";
    public UpdateCandidateProfileData? Data { get; set; }
}

public class UpdateCandidateProfileData
{
    public Guid CandidateId { get; set; }
    public Guid? UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? CurrentAddress { get; set; }
    public string? HighestEducation { get; set; }
    public decimal? YearsOfExperience { get; set; }
    public string? Summary { get; set; }
    public string ProfileVisibility { get; set; } = "PRIVATE";
    public DateTime UpdatedAt { get; set; }
}
