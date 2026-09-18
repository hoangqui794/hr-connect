using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.ApproveAffiliate;

public record ApproveAffiliateCommand(
    Guid ApplicationId,
    string? Note = null,
    Guid AdminUserId = default
) : IRequest<ApproveAffiliateResponse>;

public class ApproveAffiliateResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Affiliate application approved successfully.";
}
