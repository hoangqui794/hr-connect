using HRConnect.Application.Common.Interfaces;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.ApproveAffiliate;

public class ApproveAffiliateCommandHandler : IRequestHandler<ApproveAffiliateCommand, ApproveAffiliateResponse>
{
    private readonly IAdminApprovalService _adminApprovalService;

    public ApproveAffiliateCommandHandler(IAdminApprovalService adminApprovalService)
    {
        _adminApprovalService = adminApprovalService;
    }

    public async Task<ApproveAffiliateResponse> Handle(ApproveAffiliateCommand request, CancellationToken cancellationToken)
    {
        await _adminApprovalService.ApproveAffiliateApplicationAsync(
            request.ApplicationId,
            request.AdminUserId,
            request.Note,
            cancellationToken);

        return new ApproveAffiliateResponse();
    }
}
