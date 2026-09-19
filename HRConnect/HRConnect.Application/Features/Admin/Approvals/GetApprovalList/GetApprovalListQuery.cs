using MediatR;

namespace HRConnect.Application.Features.Admin.Approvals.GetApprovalList;

public record GetApprovalListQuery(
    string? Type = null,
    string? Status = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 20,
    string SortBy = "submittedAt",
    string SortDirection = "desc"
) : IRequest<GetApprovalListResponse>;

public class GetApprovalListResponse
{
    public bool Success { get; set; } = true;

    public GetApprovalListData Data { get; set; } = new();
}

public class GetApprovalListData
{
    public List<ApprovalListItemDto> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int Total { get; set; }

    public int TotalPages { get; set; }
}
