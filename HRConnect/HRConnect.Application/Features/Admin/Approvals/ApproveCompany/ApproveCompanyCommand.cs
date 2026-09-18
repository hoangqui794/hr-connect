using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.ApproveCompany;

public record ApproveCompanyCommand(
    Guid RequestId,
    string? Note = null,
    Guid AdminUserId = default
) : IRequest<ApproveCompanyResponse>;

public class ApproveCompanyResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Company verification request approved successfully.";
}
