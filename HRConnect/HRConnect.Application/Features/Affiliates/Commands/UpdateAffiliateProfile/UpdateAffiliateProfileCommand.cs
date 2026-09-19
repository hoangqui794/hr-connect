using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateProfile;

public class UpdateAffiliateProfileCommand : IRequest<UpdateAffiliateProfileResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string? ContactPerson { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public string? TaxInformation { get; set; }
}

public class UpdateAffiliateProfileResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Cập nhật hồ sơ đối tác tuyển dụng thành công.";
    public UpdateAffiliateProfileData? Data { get; set; }
}

public class UpdateAffiliateProfileData
{
    public Guid AffiliateId { get; set; }
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string AffiliateType { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? ContactPerson { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? TaxInformation { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? VerifiedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
