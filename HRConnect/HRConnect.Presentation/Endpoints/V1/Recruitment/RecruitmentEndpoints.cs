using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationTimeline;
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

        // A02: GET /api/v1/recruitment/applications/{applicationId:guid}
        group.MapGet("/applications/{applicationId:guid}", async (
            Guid applicationId,
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
                var query = new GetRecruitmentApplicationDetailQuery(
                    applicationId,
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin
                );

                var response = await sender.Send(query, cancellationToken);
                return Results.Ok(response);
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
        })
        .WithName("GetRecruitmentApplicationDetail")
        .WithSummary("Lấy chi tiết hồ sơ tuyển dụng")
        .WithDescription("Dành cho Client Company (chỉ xem hồ sơ của công ty mình qua quyền application.view_company), Internal HR và Admin (xem qua quyền application.view). Trả về đầy đủ thông tin ứng viên, CV, tóm tắt phỏng vấn, offer, thông tin tiếp nhận việc và các hành động được phép (allowedActions).")
        .Produces<RecruitmentApplicationDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // A03: GET /api/v1/recruitment/applications/{applicationId:guid}/timeline
        group.MapGet("/applications/{applicationId:guid}/timeline", async (
            Guid applicationId,
            [FromQuery] bool ascending = true,
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
                var query = new GetRecruitmentApplicationTimelineQuery(
                    applicationId,
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    Ascending: ascending
                );

                var response = await sender.Send(query, cancellationToken);
                return Results.Ok(response);
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
        })
        .WithName("GetRecruitmentApplicationTimeline")
        .WithSummary("Lấy dòng thời gian / lịch sử hồ sơ tuyển dụng")
        .WithDescription("Dành cho Client Company (xem hồ sơ công ty mình qua quyền application.view_company), Internal HR và Admin (qua quyền application.view). Tập hợp toàn bộ sự kiện từ lúc nộp đơn, đổi trạng thái, lên lịch/kết quả phỏng vấn, offer đến tiếp nhận việc.")
        .Produces<RecruitmentApplicationTimelineResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

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
