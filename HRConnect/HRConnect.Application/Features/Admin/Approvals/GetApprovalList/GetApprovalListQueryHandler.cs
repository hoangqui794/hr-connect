using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.GetApprovalList;

public class GetApprovalListQueryHandler : IRequestHandler<GetApprovalListQuery, GetApprovalListResponse>
{
    private readonly IApprovalRepository _approvalRepository;
    public GetApprovalListQueryHandler(IApprovalRepository approvalRepository)
    {
        _approvalRepository = approvalRepository;
    }

    public async Task<GetApprovalListResponse> Handle(GetApprovalListQuery request, CancellationToken cancellationToken)
    {
        // Endpoint validates these bounds. Keep the handler deterministic for every caller.
        var page = request.Page;
        var pageSize = request.PageSize;

        // Chuẩn hóa sortBy an toàn (chống SQL injection / arbitrary column names)
        var sortBy = request.SortBy?.ToLowerInvariant() switch
        {
            "status" => "status",
            "type" => "type",
            _ => "submittedAt"
        };

        var sortDirection = request.SortDirection?.ToLowerInvariant() == "asc" ? "asc" : "desc";

        // Chuẩn hóa type
        string? type = null;
        if (!string.IsNullOrWhiteSpace(request.Type))
        {
            var normalizedType = request.Type.Trim().ToUpperInvariant();
            if (normalizedType is "AFFILIATE" or "CLIENT")
            {
                type = normalizedType;
            }
        }

        // Chuẩn hóa status
        var status = string.IsNullOrWhiteSpace(request.Status)
            ? null
            : request.Status.Trim().ToUpperInvariant();

        // Chuẩn hóa search
        var search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim();

        var (items, totalCount) = await _approvalRepository.GetApprovalsAsync(
            type,
            status,
            search,
            sortBy,
            sortDirection,
            page,
            pageSize,
            cancellationToken);

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return new GetApprovalListResponse
        {
            Success = true,
            Data = new GetApprovalListData
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                Total = totalCount,
                TotalPages = totalPages
            }
        };
    }
}
