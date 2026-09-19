using HRConnect.Application.Features.Admin.Approvals.GetApprovalList;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface IApprovalRepository
{
    Task<(List<ApprovalListItemDto> Items, int TotalCount)> GetApprovalsAsync(
        string? type,
        string? status,
        string? search,
        string sortBy,
        string sortDirection,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);
}
