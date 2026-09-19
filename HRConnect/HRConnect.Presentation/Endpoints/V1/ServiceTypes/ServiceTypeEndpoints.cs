using System.Security.Claims;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypes;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.ServiceTypes;

public static class ServiceTypeEndpoints
{
    public static IEndpointRouteBuilder MapServiceTypeEndpoints(this IEndpointRouteBuilder app)
    {
        var publicGroup = app.MapGroup("/api/v1/service-types")
                             .WithTags("Service Types");

        // 1. GET /api/v1/service-types - Danh sách loại dịch vụ tuyển dụng
        publicGroup.MapGet("/", async (
            [FromQuery] string? search,
            [FromQuery] bool? isActive,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sortBy = "name",
            [FromQuery] string sortDirection = "asc",
            [FromServices] ISender sender = null!,
            CancellationToken cancellationToken = default) =>
        {
            var query = new GetServiceTypesQuery(search, isActive, page, pageSize, sortBy, sortDirection);
            var result = await sender.Send(query, cancellationToken);
            return Results.Ok(result);
        })
        .WithName("GetServiceTypes")
        .WithSummary("Lấy danh sách loại dịch vụ tuyển dụng")
        .WithDescription("Cho phép lọc theo isActive, tìm kiếm theo code/name, phân trang và sắp xếp.")
        .Produces<GetServiceTypesResponse>(StatusCodes.Status200OK);

        // Alias tương thích /api/service-types
        app.MapGet("/api/service-types", async (
            [FromQuery] string? search,
            [FromQuery] bool? isActive,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sortBy = "name",
            [FromQuery] string sortDirection = "asc",
            [FromServices] ISender sender = null!,
            CancellationToken cancellationToken = default) =>
        {
            var query = new GetServiceTypesQuery(search, isActive, page, pageSize, sortBy, sortDirection);
            var result = await sender.Send(query, cancellationToken);
            return Results.Ok(result);
        })
        .WithTags("Service Types")
        .WithName("GetServiceTypesLegacy")
        .ExcludeFromDescription();

        return app;
    }
}
