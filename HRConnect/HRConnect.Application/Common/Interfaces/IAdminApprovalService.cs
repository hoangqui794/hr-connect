namespace HRConnect.Application.Common.Interfaces;

public interface IAdminApprovalService
{
    Task ApproveAffiliateApplicationAsync(Guid applicationId, Guid adminUserId, string? reviewNote = null, CancellationToken cancellationToken = default);

    Task RejectAffiliateApplicationAsync(Guid applicationId, Guid adminUserId, string? reviewNote = null, CancellationToken cancellationToken = default);

    Task ApproveCompanyVerificationRequestAsync(Guid requestId, Guid adminUserId, string? reviewNote = null, CancellationToken cancellationToken = default);

    Task RejectCompanyVerificationRequestAsync(Guid requestId, Guid adminUserId, string? reviewNote = null, CancellationToken cancellationToken = default);
}
