using HRConnect.Application.Common.Interfaces;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.RejectCompany;

public class RejectCompanyCommandHandler : IRequestHandler<RejectCompanyCommand, RejectCompanyResponse>
{
    private readonly IAdminApprovalService _adminApprovalService;

    public RejectCompanyCommandHandler(IAdminApprovalService adminApprovalService)
    {
        _adminApprovalService = adminApprovalService;
    }

    public async Task<RejectCompanyResponse> Handle(RejectCompanyCommand request, CancellationToken cancellationToken)
    {
        await _adminApprovalService.RejectCompanyVerificationRequestAsync(
            request.RequestId,
            request.AdminUserId,
            request.Reason.Trim(),
            cancellationToken);

        return new RejectCompanyResponse();
    }
}
