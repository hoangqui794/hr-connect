using HRConnect.Application.Common.Interfaces;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.RejectAffiliate;

public class RejectAffiliateCommandHandler : IRequestHandler<RejectAffiliateCommand, RejectAffiliateResponse>
{
    private readonly IAdminApprovalService _adminApprovalService;

    public RejectAffiliateCommandHandler(IAdminApprovalService adminApprovalService)
    {
        _adminApprovalService = adminApprovalService;
    }

    public async Task<RejectAffiliateResponse> Handle(RejectAffiliateCommand request, CancellationToken cancellationToken)
    {
        await _adminApprovalService.RejectAffiliateApplicationAsync(
            request.ApplicationId,
            request.AdminUserId,
            request.Reason.Trim(),
            cancellationToken);

        return new RejectAffiliateResponse();
    }
}
