using System;
using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.ServiceTypes.Commands.CreateServiceType;
using HRConnect.Application.Features.ServiceTypes.Commands.DeleteServiceType;
using HRConnect.Application.Features.ServiceTypes.Commands.UpdateServiceType;
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

        // ==============================================================================
        // ADMIN ENDPOINTS
        // ==============================================================================
        var adminGroup = app.MapGroup("/api/v1/admin/service-types")
                            .WithTags("Admin Service Types")
                            .RequireAuthorization();

        // 3. POST /api/v1/admin/service-types - Tạo mới loại dịch vụ (Platform Admin)
        adminGroup.MapPost("/", async (
            [FromBody] CreateServiceTypeCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<CreateServiceTypeCommand> validator,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu yêu cầu không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key,
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/v1/service-types/{result.Data?.Id}", result);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("CreateServiceType")
        .WithSummary("Tạo loại dịch vụ tuyển dụng mới (Platform Admin)")
        .WithDescription("Chỉ dành cho Platform Admin. Mã code được tự động chuẩn hóa sang UPPER_SNAKE_CASE và phải là duy nhất.")
        .Produces<CreateServiceTypeResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status409Conflict);

        // Alias tương thích /api/admin/service-types
        app.MapPost("/api/admin/service-types", async (
            [FromBody] CreateServiceTypeCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<CreateServiceTypeCommand> validator,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu yêu cầu không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key,
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/v1/service-types/{result.Data?.Id}", result);
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .RequireAuthorization()
        .WithTags("Admin Service Types")
        .WithName("CreateServiceTypeLegacy")
        .ExcludeFromDescription();

        // 4. PUT /api/v1/admin/service-types/{id} - Cập nhật loại dịch vụ (Platform Admin)
        adminGroup.MapPut("/{id:guid}", async (
            Guid id,
            [FromBody] UpdateServiceTypeCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateServiceTypeCommand> validator,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            command.Id = id;

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu yêu cầu không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key,
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("UpdateServiceType")
        .WithSummary("Cập nhật loại dịch vụ tuyển dụng (Platform Admin)")
        .WithDescription("Chỉ dành cho Platform Admin. Không cho phép đổi mã Code nếu loại dịch vụ đã phát sinh dữ liệu liên kết.")
        .Produces<UpdateServiceTypeResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // Alias tương thích /api/admin/service-types/{id}
        app.MapPut("/api/admin/service-types/{id:guid}", async (
            Guid id,
            [FromBody] UpdateServiceTypeCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateServiceTypeCommand> validator,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            command.Id = id;

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu yêu cầu không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(
                            g => g.Key,
                            g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .RequireAuthorization()
        .WithTags("Admin Service Types")
        .WithName("UpdateServiceTypeLegacy")
        .ExcludeFromDescription();

        // 5. DELETE /api/v1/admin/service-types/{id} - Xóa loại dịch vụ (Platform Admin)
        adminGroup.MapDelete("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            try
            {
                var result = await sender.Send(new DeleteServiceTypeCommand(id), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
        })
        .WithName("DeleteServiceType")
        .WithSummary("Xóa loại dịch vụ tuyển dụng (Platform Admin)")
        .WithDescription("Chỉ dành cho Platform Admin. Nếu loại dịch vụ chưa liên kết dữ liệu sẽ bị xóa hoàn toàn; nếu đã được sử dụng sẽ chuyển sang trạng thái ngưng hoạt động (deactivated).")
        .Produces<DeleteServiceTypeResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // Alias tương thích /api/admin/service-types/{id}
        app.MapDelete("/api/admin/service-types/{id:guid}", async (
            Guid id,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            try
            {
                var result = await sender.Send(new DeleteServiceTypeCommand(id), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
        })
        .RequireAuthorization()
        .WithTags("Admin Service Types")
        .WithName("DeleteServiceTypeLegacy")
        .ExcludeFromDescription();

        return app;
    }

    private static bool HasAdminAccess(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "service_type.manage") ||
        user.HasClaim("permission", "system_config.manage");
}
