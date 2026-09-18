using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.RejectAffiliate;

public record RejectAffiliateCommand(
    Guid ApplicationId,
    string Reason,
    Guid AdminUserId = default
) : IRequest<RejectAffiliateResponse>;

public class RejectAffiliateResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Affiliate application rejected successfully.";
}
