using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class RecruitmentEndpoints
{
    private const string ViewCompanyPermission = "application.view_company";
    private const string ViewAllPermission = "application.view";

    public static IEndpointRouteBuilder MapRecruitmentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/recruitment")
                       .WithTags("Recruitment")
                       .RequireAuthorization();

        // A01: GET /api/v1/recruitment/applications
        group.MapGet("/applications", async (
            [FromQuery] Guid? jobId,
            [FromQuery] string? status,
            [FromQuery] string? candidateName,
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
            var isInternal = PermissionAuthorization.HasPermission(user, ViewAllPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(ViewAllPermission);
            }

            try
            {
                var query = new GetRecruitmentApplicationsQuery(
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    JobId: jobId,
                    Status: status,
                    CandidateName: candidateName,
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
        .WithName("GetRecruitmentApplications")
        .WithSummary("Lấy danh sách hồ sơ tuyển dụng")
        .WithDescription("Dành cho Client Company (xem hồ sơ thuộc công ty mình qua quyền application.view_company), Internal HR và Admin (xem toàn hệ thống qua quyền application.view). Hỗ trợ lọc theo công việc, trạng thái, tên ứng viên, khoảng thời gian và phân trang.")
        .Produces<RecruitmentApplicationsResponse>(StatusCodes.Status200OK)
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
