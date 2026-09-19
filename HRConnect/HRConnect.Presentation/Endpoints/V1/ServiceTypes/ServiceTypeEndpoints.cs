using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.ServiceTypes.DTOs;
using HRConnect.Application.Features.ServiceTypes.Queries.GetServiceTypeDetail;
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

        // 2. GET /api/v1/service-types/{id} - Chi tiết loại dịch vụ tuyển dụng
        publicGroup.MapGet("/{id:guid}", async (
            Guid id,
            [FromServices] ISender sender = null!,
            CancellationToken cancellationToken = default) =>
        {
            try
            {
                var result = await sender.Send(new GetServiceTypeDetailQuery(id), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetServiceTypeDetail")
        .WithSummary("Xem chi tiết một loại dịch vụ tuyển dụng")
        .WithDescription("Trả về thông tin chi tiết loại dịch vụ theo ID.")
        .Produces<GetServiceTypeDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status404NotFound);

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

        // Alias tương thích /api/service-types/{id}
        app.MapGet("/api/service-types/{id:guid}", async (
            Guid id,
            [FromServices] ISender sender = null!,
            CancellationToken cancellationToken = default) =>
        {
            try
            {
                var result = await sender.Send(new GetServiceTypeDetailQuery(id), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
        })
        .WithTags("Service Types")
        .WithName("GetServiceTypeDetailLegacy")
        .ExcludeFromDescription();

        return app;
    }
}
