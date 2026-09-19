using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;

public class UpdateCompanyProfileCommand : IRequest<UpdateCompanyProfileResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public string? TaxCode { get; set; }

    public string? Industry { get; set; }

    public string? CompanySize { get; set; }

    public string? Website { get; set; }

    public string? Address { get; set; }

    public string? Description { get; set; }
}

public class UpdateCompanyProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật hồ sơ doanh nghiệp thành công.";
    public UpdateCompanyProfileData? Data { get; set; }
}

public class UpdateCompanyProfileData
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
