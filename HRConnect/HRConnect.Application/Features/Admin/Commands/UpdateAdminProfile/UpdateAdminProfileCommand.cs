using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Admin.Commands.UpdateAdminProfile;

public class UpdateAdminProfileCommand : IRequest<UpdateAdminProfileResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string? Phone { get; set; }

    public string? JobTitle { get; set; }
}

public class UpdateAdminProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật hồ sơ quản trị viên thành công.";
    public UpdateAdminProfileData? Data { get; set; }
}

public class UpdateAdminProfileData
{
    public Guid AdminProfileId { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public string? EmployeeCode { get; set; }
    public string? JobTitle { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
