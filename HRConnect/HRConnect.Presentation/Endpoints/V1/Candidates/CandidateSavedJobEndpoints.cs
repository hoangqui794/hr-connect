using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Candidates.SavedJobs.Commands.SaveJob;
using HRConnect.Application.Features.Candidates.SavedJobs.Commands.UnsaveJob;
using HRConnect.Application.Features.Candidates.SavedJobs.DTOs;
using HRConnect.Application.Features.Candidates.SavedJobs.Queries.GetCandidateSavedJobs;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace HRConnect.Presentation.Endpoints.V1.Candidates;

public static class CandidateSavedJobEndpoints
{
    public static IEndpointRouteBuilder MapCandidateSavedJobEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/candidates/me/saved-jobs")
                       .WithTags("Candidate Saved Jobs")
                       .RequireAuthorization();

        // 1. GET /api/v1/candidates/me/saved-jobs
        group.MapGet("", async (
            ClaimsPrincipal user,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromServices] ISender sender,
            CancellationToken ct) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();

            try
            {
                var result = await sender.Send(new GetCandidateSavedJobsQuery(
                    userId.Value,
                    page is > 0 ? page.Value : 1,
                    pageSize is > 0 ? pageSize.Value : 20), ct);

                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message, errorCode = ex.ErrorCode }, statusCode: StatusCodes.Status403Forbidden);
            }
        })
        .WithName("GetCandidateSavedJobs")
        .WithSummary("Lấy danh sách việc làm đã lưu của ứng viên")
        .WithDescription("Yêu cầu đăng nhập tài khoản Candidate. Danh sách trả về được phân trang tại database, sắp xếp mới nhất trước và chứa thẻ thông tin Job gọn nhẹ.")
        .Produces<SavedJobPageDto>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // 2. POST /api/v1/candidates/me/saved-jobs/{jobId:guid}
        group.MapPost("/{jobId:guid}", async (
            Guid jobId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken ct) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();

            try
            {
                var result = await sender.Send(new SaveJobCommand(userId.Value, jobId), ct);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message, errorCode = ex.ErrorCode }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("SaveJob")
        .WithSummary("Lưu việc làm vào danh sách quan tâm")
        .WithDescription("Idempotent: lưu lại cùng một việc làm sẽ không tạo bản ghi trùng. Chỉ cho phép lưu việc làm Candidate có quyền xem theo Service Type và visibility.")
        .Produces<SaveJobResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // 3. DELETE /api/v1/candidates/me/saved-jobs/{jobId:guid}
        group.MapDelete("/{jobId:guid}", async (
            Guid jobId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken ct) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();

            try
            {
                var result = await sender.Send(new UnsaveJobCommand(userId.Value, jobId), ct);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message, errorCode = ex.ErrorCode }, statusCode: StatusCodes.Status403Forbidden);
            }
        })
        .WithName("UnsaveJob")
        .WithSummary("Xóa việc làm khỏi danh sách đã lưu")
        .WithDescription("Idempotent: xóa việc làm đã lưu của ứng viên. Nếu việc làm chưa được lưu hoặc đã xóa trước đó, API vẫn trả về thành công.")
        .Produces<SaveJobResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static Guid? GetUserIdFromClaims(ClaimsPrincipal user)
    {
        var claimValue = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? user.FindFirst("sub")?.Value;

        return Guid.TryParse(claimValue, out var userId) ? userId : null;
    }
}
