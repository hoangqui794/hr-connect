namespace HRConnect.Application.Features.Companies.Queries.GetCompanyProfile;

public class CompanyProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Lấy thông tin hồ sơ doanh nghiệp thành công.";
    public CompanyProfileData? Data { get; set; }
}

public class CompanyProfileData
{
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string? TaxCode { get; set; }
    public string? Industry { get; set; }
    public string? CompanySize { get; set; }
    public string? Website { get; set; }
    public string? Address { get; set; }
    public string? Description { get; set; }
    public string VerificationStatus { get; set; } = string.Empty;
    public DateTime? VerifiedAt { get; set; }
    public string? RoleInCompany { get; set; }
    public bool IsPrimaryContact { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
