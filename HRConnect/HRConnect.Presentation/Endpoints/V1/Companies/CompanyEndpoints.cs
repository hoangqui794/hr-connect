using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Companies.Queries.GetCompanyProfile;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Companies;

public static class CompanyEndpoints
{
    public static IEndpointRouteBuilder MapCompanyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/companies/profile")
                       .WithTags("Company Profile")
                       .RequireAuthorization();

        // 1. GET /api/v1/companies/profile/me - Xem hồ sơ công ty hiện tại
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
                var result = await sender.Send(new GetCompanyProfileQuery(userId.Value), cancellationToken);
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
        .WithName("GetCompanyProfile")
        .WithSummary("Xem thông tin hồ sơ doanh nghiệp hiện tại")
        .WithDescription("Lấy toàn bộ thông tin chi tiết hồ sơ công ty mà người dùng hiện tại đang trực thuộc (Client Company User) dựa trên JWT Bearer Token.")
        .Produces<CompanyProfileResponse>(StatusCodes.Status200OK)
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
