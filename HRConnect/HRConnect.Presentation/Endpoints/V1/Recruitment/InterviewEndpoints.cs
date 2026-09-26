using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Queries.GetInterviews;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class InterviewEndpoints
{
    private const string ViewCompanyPermission = "interview.view_company";
    private const string ViewOwnPermission = "interview.view_own";
    private const string ManagePermission = "interview.manage";

    public static IEndpointRouteBuilder MapInterviewEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/interviews")
                       .WithTags("Interviews")
                       .RequireAuthorization();

        // I01: GET /api/v1/interviews
        group.MapGet("/", async (
            [FromQuery] Guid? jobId,
            [FromQuery] Guid? applicationId,
            [FromQuery] Guid? interviewerId,
            [FromQuery] string? status,
            [FromQuery] string? result,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManagePermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ManagePermission);
            }

            try
            {
                var query = new GetInterviewsQuery(
                    UserId: userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    IsCandidate: isCandidate && !isClient && !isInternal && !isAdmin,
                    JobId: jobId,
                    ApplicationId: applicationId,
                    InterviewerId: interviewerId,
                    Status: status,
                    Result: result,
                    FromDate: fromDate,
                    ToDate: toDate,
                    Page: page,
                    PageSize: pageSize
                );

                var response = await sender.Send(query, cancellationToken);
                return Results.Ok(response);
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetInterviews")
        .WithSummary("Lấy danh sách lịch phỏng vấn")
        .WithDescription("Hỗ trợ lọc theo jobId, applicationId, interviewerId, status, result, khoảng thời gian và phân trang. Tự động áp dụng phân quyền theo Client Company (interview.view_company), Internal HR (interview.manage), hoặc Candidate (interview.view_own).")
        .Produces<GetInterviewsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

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
