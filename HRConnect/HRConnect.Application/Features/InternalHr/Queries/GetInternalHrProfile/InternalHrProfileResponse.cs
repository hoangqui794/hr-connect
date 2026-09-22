namespace HRConnect.Application.Features.InternalHr.Queries.GetInternalHrProfile;

public class InternalHrProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy thông tin hồ sơ nhân sự Agency thành công.";
    public InternalHrProfileData? Data { get; set; }
}

public class InternalHrProfileData
{
    public Guid HrProfileId { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public string? EmployeeCode { get; set; }
    public string? Department { get; set; }
    public string? JobTitle { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
