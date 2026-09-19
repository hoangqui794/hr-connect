using HRConnect.Application.Common.Interfaces;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.ApproveCompany;

public class ApproveCompanyCommandHandler : IRequestHandler<ApproveCompanyCommand, ApproveCompanyResponse>
{
    private readonly IAdminApprovalService _adminApprovalService;

    public ApproveCompanyCommandHandler(IAdminApprovalService adminApprovalService)
    {
        _adminApprovalService = adminApprovalService;
    }

    public async Task<ApproveCompanyResponse> Handle(ApproveCompanyCommand request, CancellationToken cancellationToken)
    {
        await _adminApprovalService.ApproveCompanyVerificationRequestAsync(
            request.RequestId,
            request.AdminUserId,
            request.Note,
            cancellationToken);

        return new ApproveCompanyResponse();
    }
}
