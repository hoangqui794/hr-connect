using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.GetCompanyVerificationDetail;

public record GetCompanyVerificationDetailQuery(Guid RequestId) : IRequest<GetCompanyVerificationDetailResponse>;

public class GetCompanyVerificationDetailResponse
{
    public bool Success { get; set; } = true;

    public CompanyVerificationDetailDto? Data { get; set; }
}

public class CompanyVerificationDetailDto
{
    public Guid VerificationRequestId { get; set; }

    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string? DisplayName { get; set; }

    public string? Phone { get; set; }

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    public string? TaxCode { get; set; }

    public string? Industry { get; set; }

    public string? CompanySize { get; set; }

    public string? Website { get; set; }

    public string? Address { get; set; }

    public string? Description { get; set; }

    public string SubmittedPayload { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTime SubmittedAt { get; set; }

    public Guid? ReviewedBy { get; set; }

    public string? ReviewerName { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public string? ReviewNote { get; set; }
}
