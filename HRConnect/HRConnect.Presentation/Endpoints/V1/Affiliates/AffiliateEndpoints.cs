using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateProfile;
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

        // 2. PUT /api/v1/affiliates/profile/me - Cập nhật hồ sơ đối tác tuyển dụng
        group.MapPut("/me", async (
            ClaimsPrincipal user,
            [FromBody] UpdateAffiliateProfileCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateAffiliateProfileCommand> validator,
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
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("UpdateAffiliateProfile")
        .WithSummary("Cập nhật thông tin hồ sơ đối tác tuyển dụng")
        .WithDescription("Cập nhật thông tin hồ sơ cá nhân hoặc doanh nghiệp của đối tác tuyển dụng (tên hiển thị, người liên hệ, số điện thoại, địa chỉ, mã số thuế). Tự động đồng bộ tên và số điện thoại sang tài khoản người dùng.")
        .Produces<UpdateAffiliateProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
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
