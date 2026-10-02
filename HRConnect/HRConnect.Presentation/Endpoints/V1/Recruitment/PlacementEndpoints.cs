using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Placements.Queries.GetPlacementDetail;
using HRConnect.Application.Features.Placements.Queries.GetPlacements;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class PlacementEndpoints
{
    private const string PlacementManagePermission = "placement.manage";
    private const string PlacementConfirmPermission = "placement.confirm";
    private const string ViewCompanyPermission = "application.view_company";

    public static IEndpointRouteBuilder MapPlacementEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/placements")
            .WithTags("Placements")
            .RequireAuthorization();

        // P04: GET /api/v1/placements
        group.MapGet("/", async (
            [FromQuery] Guid? companyId,
            [FromQuery] Guid? jobId,
            [FromQuery] Guid? candidateId,
            [FromQuery] string? status,
            [FromQuery] DateOnly? fromDate,
            [FromQuery] DateOnly? toDate,
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

            var isClient = PermissionAuthorization.HasPermission(user, PlacementConfirmPermission) ||
                           PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = PermissionAuthorization.HasPermission(user, PlacementManagePermission) ||
                             PermissionAuthorization.HasPermission(user, "application.view");
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(PlacementManagePermission);
            }

            var isInternalOrAdmin = user.IsInRole("INTERNAL_HR") || isAdmin || isInternal;
            var isClientUser = !isInternalOrAdmin;

            try
            {
                var query = new GetPlacementsQuery(
                    CurrentUserId: userId.Value,
                    CompanyId: companyId,
                    JobId: jobId,
                    CandidateId: candidateId,
                    Status: status,
                    FromDate: fromDate,
                    ToDate: toDate,
                    Page: page,
                    PageSize: pageSize,
                    IsClientCompanyUser: isClientUser,
                    IsInternalHrOrAdmin: isInternalOrAdmin
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
        .WithName("GetPlacements")
        .WithSummary("Lấy danh sách tiếp nhận việc (Placements)")
        .WithDescription("Dành cho Client Company HR / Admin (xem các placement của công ty mình) hoặc Internal HR / Admin (xem toàn hệ thống qua quyền placement.manage). Hỗ trợ lọc theo doanh nghiệp, công việc, ứng viên, trạng thái, khoảng ngày đi làm và phân trang.")
        .Produces<GetPlacementsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        // P05: GET /api/v1/placements/{placementId:guid}
        group.MapGet("/{placementId:guid}", async (
            Guid placementId,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, PlacementConfirmPermission) ||
                           PermissionAuthorization.HasPermission(user, ViewCompanyPermission);
            var isInternal = PermissionAuthorization.HasPermission(user, PlacementManagePermission) ||
                             PermissionAuthorization.HasPermission(user, "application.view");
            var isCandidate = user.IsInRole("CANDIDATE");
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(PlacementManagePermission);
            }

            var isInternalOrAdmin = user.IsInRole("INTERNAL_HR") || isAdmin || isInternal;
            var isClientUser = !isInternalOrAdmin && isClient;
            var isCandidateUser = !isInternalOrAdmin && !isClientUser && isCandidate;

            try
            {
                var query = new GetPlacementDetailQuery(
                    PlacementId: placementId,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: isClientUser,
                    IsInternalHrOrAdmin: isInternalOrAdmin,
                    IsCandidate: isCandidateUser
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
        })
        .WithName("GetPlacementDetail")
        .WithSummary("Lấy chi tiết tiếp nhận việc (Placement Detail)")
        .WithDescription("Dành cho Client Company HR / Admin (xem placement thuộc công ty mình), Candidate (xem placement của chính mình), hoặc Internal HR / Admin (xem toàn hệ thống qua quyền placement.manage). Trả về thông tin chi tiết ứng viên, công việc, offer, thử việc (probation), bảo hành (warranty) và các hành động được phép.")
        .Produces<GetPlacementDetailResponse>(StatusCodes.Status200OK)
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
