using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateProfile;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Affiliates;

public static class AffiliateEndpoints
{
    public static IEndpointRouteBuilder MapAffiliateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/affiliates/profile")
                       .WithTags("Affiliate Profile")
                       .RequireAuthorization();

        // 1. GET /api/v1/affiliates/profile/me - Xem hồ sơ đối tác tuyển dụng
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
                var result = await sender.Send(new GetAffiliateProfileQuery(userId.Value), cancellationToken);
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
        .WithName("GetAffiliateProfile")
        .WithSummary("Xem thông tin hồ sơ đối tác tuyển dụng hiện tại")
        .WithDescription("Lấy toàn bộ thông tin chi tiết hồ sơ đối tác tuyển dụng (Affiliate Recruiter) của người dùng đang đăng nhập dựa trên JWT Bearer Token.")
        .Produces<AffiliateProfileResponse>(StatusCodes.Status200OK)
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
