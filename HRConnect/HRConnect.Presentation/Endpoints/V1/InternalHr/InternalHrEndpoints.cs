using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.InternalHr.Queries.GetInternalHrProfile;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.InternalHr;

public static class InternalHrEndpoints
{
    public static IEndpointRouteBuilder MapInternalHrEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/internal/profile")
                       .WithTags("Internal HR Profile")
                       .RequireAuthorization();

        // 1. GET /api/v1/internal/profile/me - Xem hồ sơ nhân sự Agency hiện tại
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
                var result = await sender.Send(new GetInternalHrProfileQuery(userId.Value), cancellationToken);
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
        .WithName("GetInternalHrProfile")
        .WithSummary("Xem thông tin hồ sơ nhân sự Agency hiện tại")
        .WithDescription("Lấy toàn bộ thông tin chi tiết hồ sơ chuyên viên tuyển dụng Agency (Internal HR) của người dùng đang đăng nhập dựa trên JWT Bearer Token.")
        .Produces<InternalHrProfileResponse>(StatusCodes.Status200OK)
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
