using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
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
