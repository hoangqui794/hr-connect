using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.RejectCompany;

public record RejectCompanyCommand(
    Guid RequestId,
    string Reason,
    Guid AdminUserId = default
) : IRequest<RejectCompanyResponse>;

public class RejectCompanyResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Company verification request rejected successfully.";
}
