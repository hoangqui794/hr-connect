using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Admin.Commands.UpdateAdminProfile;
using HRConnect.Application.Features.Admin.Queries.GetAdminProfile;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Admin;

public static class AdminProfileEndpoints
{
    public static IEndpointRouteBuilder MapAdminProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/profile")
                       .WithTags("Admin Profile")
                       .RequireAuthorization();

        // 1. GET /api/v1/admin/profile/me - Xem hồ sơ Quản trị viên nền tảng
        group.MapGet("/me", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var result = await sender.Send(new GetAdminProfileQuery(userId.Value), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("GetAdminProfile")
        .WithSummary("Xem thông tin hồ sơ Quản trị viên nền tảng")
        .WithDescription("Lấy toàn bộ thông tin chi tiết hồ sơ cá nhân của Quản trị viên nền tảng (Platform Admin) đang đăng nhập dựa trên JWT Bearer Token (bao gồm Mã nhân viên, Chức danh, Email, Số điện thoại, Trạng thái tài khoản).")
        .Produces<AdminProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 2. PUT /api/v1/admin/profile/me - Cập nhật hồ sơ Quản trị viên nền tảng hiện tại
        group.MapPut("/me", async (
            ClaimsPrincipal user,
            [FromBody] UpdateAdminProfileCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateAdminProfileCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            command.UserId = userId.Value;

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu cập nhật hồ sơ không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())
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
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("UpdateAdminProfile")
        .WithSummary("Cập nhật thông tin hồ sơ Quản trị viên nền tảng")
        .WithDescription("Cập nhật thông tin hồ sơ của Quản trị viên nền tảng (Họ tên, số điện thoại, chức danh). Tự động đồng bộ họ tên và số điện thoại sang tài khoản người dùng.")
        .Produces<UpdateAdminProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        return app;
    }

    private static Guid? GetUserIdFromClaims(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? user.FindFirst("sub")?.Value;

        if (Guid.TryParse(idClaim, out var userId))
        {
            return userId;
        }

        return null;
    }
}
