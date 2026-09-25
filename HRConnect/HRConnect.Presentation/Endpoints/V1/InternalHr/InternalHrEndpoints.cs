using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.InternalHr.Commands.UpdateInternalHrProfile;
using HRConnect.Application.Features.InternalHr.Commands.RetryAiScoring;
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

        // 2. PUT /api/v1/internal/profile/me - Cập nhật hồ sơ nhân sự Agency hiện tại
        group.MapPut("/me", async (
            ClaimsPrincipal user,
            [FromBody] UpdateInternalHrProfileCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateInternalHrProfileCommand> validator,
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
        .WithName("UpdateInternalHrProfile")
        .WithSummary("Cập nhật thông tin hồ sơ nhân sự Agency")
        .WithDescription("Cập nhật thông tin hồ sơ của chuyên viên tuyển dụng Agency (Họ tên, số điện thoại, phòng ban, chức vụ). Tự động đồng bộ họ tên và số điện thoại sang tài khoản người dùng.")
        .Produces<UpdateInternalHrProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        var applicationsGroup = app.MapGroup("/api/v1/internal/applications")
            .WithTags("Internal HR AI Screening")
            .RequireAuthorization();

        applicationsGroup.MapPost("/{applicationId:guid}/ai-scoring/retry", async (
            Guid applicationId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();
            if (!CanRetryAiScoring(user))
                return Results.Json(new { success = false, message = "Bạn không có quyền yêu cầu chấm AI lại." }, statusCode: StatusCodes.Status403Forbidden);

            try
            {
                var result = await sender.Send(new RetryAiScoringCommand(applicationId, userId.Value), cancellationToken);
                return Results.Json(result, statusCode: StatusCodes.Status202Accepted);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
        })
        .WithName("RetryAiScoring")
        .WithSummary("Yêu cầu AI chấm lại một hồ sơ thất bại")
        .WithDescription("Chỉ Internal HR hoặc Platform Admin có quyền mới được tạo lượt chấm AI mới cho Application có attempt gần nhất FAILED. Không tạo Submission hoặc CV mới.")
        .Produces<RetryAiScoringResponse>(StatusCodes.Status202Accepted)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

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

    private static bool CanRetryAiScoring(ClaimsPrincipal user) =>
        (user.IsInRole("INTERNAL_HR") || user.IsInRole("PLATFORM_ADMIN")) &&
        user.HasClaim("permission", "application.retry_ai_scoring");
}
