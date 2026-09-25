namespace HRConnect.Application.Features.Admin.Queries.GetAdminProfile;

public class AdminProfileData
{
    public Guid AdminProfileId { get; set; }
    public Guid UserId { get; set; }
    public string? Email { get; set; }
    public string? DisplayName { get; set; }
    public string? Phone { get; set; }
    public string? AvatarUrl { get; set; }
    public string? EmployeeCode { get; set; }
    public string? JobTitle { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class AdminProfileResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public AdminProfileData? Data { get; set; }
}
