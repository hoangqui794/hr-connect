namespace HRConnect.Application.Features.Admin.Approvals.GetApprovalList;

public class ApprovalListItemDto
{
    public Guid ApprovalId { get; set; }

    public string Type { get; set; } = string.Empty; // "AFFILIATE" | "CLIENT"

    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string? CompanyName { get; set; }

    public string Status { get; set; } = string.Empty;

    public DateTime SubmittedAt { get; set; }
}
