using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.GetAffiliateApplicationDetail;

public record GetAffiliateApplicationDetailQuery(Guid ApplicationId) : IRequest<GetAffiliateApplicationDetailResponse>;

public class GetAffiliateApplicationDetailResponse
{
    public bool Success { get; set; } = true;

    public AffiliateApplicationDetailDto? Data { get; set; }
}

public class AffiliateApplicationDetailDto
{
    public Guid ApplicationId { get; set; }

    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string? DisplayName { get; set; }

    public string? Phone { get; set; }

    public string AffiliateType { get; set; } = string.Empty;

    public string? TaxInformation { get; set; }

    public string? ContactPerson { get; set; }

    public string? Address { get; set; }

    public string SubmittedData { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTime SubmittedAt { get; set; }

    public Guid? ReviewedBy { get; set; }

    public string? ReviewerName { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewNote { get; set; }
}
