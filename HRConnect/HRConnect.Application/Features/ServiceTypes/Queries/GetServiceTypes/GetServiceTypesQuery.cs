using System.Collections.Generic;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypes;

public record GetServiceTypesQuery(
    string? Search = null,
    bool? IsActive = null,
    int Page = 1,
    int PageSize = 20,
    string SortBy = "name",
    string SortDirection = "asc"
) : IRequest<GetServiceTypesResponse>;

public class GetServiceTypesResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy danh sách loại dịch vụ thành công.";

    public GetServiceTypesData Data { get; set; } = new();
}

public class GetServiceTypesData
{
    public List<ServiceTypeDto> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int Total { get; set; }

    public int TotalPages { get; set; }
}
