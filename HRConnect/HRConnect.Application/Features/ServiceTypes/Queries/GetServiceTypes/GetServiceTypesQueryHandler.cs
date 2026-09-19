using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using MediatR;

namespace HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypes;

public class GetServiceTypesQueryHandler : IRequestHandler<GetServiceTypesQuery, GetServiceTypesResponse>
{
    private readonly IServiceTypeRepository _serviceTypeRepository;
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    public GetServiceTypesQueryHandler(IServiceTypeRepository serviceTypeRepository)
    {
        _serviceTypeRepository = serviceTypeRepository;
    }

    public async Task<GetServiceTypesResponse> Handle(GetServiceTypesQuery request, CancellationToken cancellationToken)
    {
        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? DefaultPageSize : (request.PageSize > MaxPageSize ? MaxPageSize : request.PageSize);

        var sortBy = request.SortBy?.ToLowerInvariant() switch
        {
            "code" => "code",
            "createdat" => "createdat",
            "updatedat" => "updatedat",
            "isactive" => "isactive",
            _ => "name"
        };

        var sortDirection = string.Equals(request.SortDirection, "desc", StringComparison.OrdinalIgnoreCase) ? "desc" : "asc";

        var (items, totalCount) = await _serviceTypeRepository.GetListAsync(
            request.Search,
            request.IsActive,
            sortBy,
            sortDirection,
            page,
            pageSize,
            cancellationToken);

        var dtos = items.Select(st => new ServiceTypeDto
        {
            Id = st.ServiceTypeId,
            Code = st.Code,
            Name = st.Name,
            Description = st.Description,
            IsActive = st.IsActive,
            CreatedAt = st.CreatedAt,
            UpdatedAt = st.UpdatedAt
        }).ToList();

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return new GetServiceTypesResponse
        {
            Success = true,
            Message = "Lấy danh sách loại dịch vụ thành công.",
            Data = new GetServiceTypesData
            {
                Items = dtos,
                Page = page,
                PageSize = pageSize,
                Total = totalCount,
                TotalPages = totalPages
            }
        };
    }
}
