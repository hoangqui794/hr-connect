using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.GetApprovalList;

public class GetApprovalListQueryHandler : IRequestHandler<GetApprovalListQuery, GetApprovalListResponse>
{
    private readonly IApprovalRepository _approvalRepository;
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    public GetApprovalListQueryHandler(IApprovalRepository approvalRepository)
    {
        _approvalRepository = approvalRepository;
    }

    public async Task<GetApprovalListResponse> Handle(GetApprovalListQuery request, CancellationToken cancellationToken)
    {
        // Chuẩn hóa và giới hạn page, pageSize
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? DefaultPageSize : (request.PageSize > MaxPageSize ? MaxPageSize : request.PageSize);

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
        var status = string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim();

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
