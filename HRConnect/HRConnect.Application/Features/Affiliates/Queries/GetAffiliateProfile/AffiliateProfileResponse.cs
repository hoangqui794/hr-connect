namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateProfile;

public class AffiliateProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy thông tin hồ sơ đối tác tuyển dụng thành công.";
    public AffiliateProfileData? Data { get; set; }
}

public class AffiliateProfileData
{
    public Guid AffiliateId { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AffiliateType { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? TaxInformation { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? VerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
