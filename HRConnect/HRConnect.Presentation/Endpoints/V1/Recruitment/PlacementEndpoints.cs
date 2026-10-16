using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Placements.Queries.GetPlacementDetail;
using HRConnect.Application.Features.Placements.Queries.GetPlacements;
using HRConnect.Application.Features.Placements.Commands.CorrectPlacementStartDate;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class PlacementEndpoints
{
    private const string PlacementConfirmPermission = "placement.confirm";
    private const string ViewCompanyPermission = "application.view_company";
    private const string InternalViewPermission = "application.view";

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
            var isInternal = PermissionAuthorization.HasPermission(user, InternalViewPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(InternalViewPermission);
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
        .WithDescription("Dành cho Client Company HR / Admin (xem các placement của công ty mình) hoặc Internal HR / Admin (xem toàn hệ thống qua quyền application.view). Hỗ trợ lọc theo doanh nghiệp, công việc, ứng viên, trạng thái, khoảng ngày đi làm và phân trang.")
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
            var isInternal = PermissionAuthorization.HasPermission(user, InternalViewPermission);
            var isCandidate = user.IsInRole("CANDIDATE");
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(InternalViewPermission);
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
        .WithDescription("Dành cho Client Company HR / Admin (xem placement thuộc công ty mình), Candidate (xem placement của chính mình), hoặc Internal HR / Admin (xem toàn hệ thống qua quyền application.view). Trả về thông tin chi tiết ứng viên, công việc, offer, thử việc (probation), bảo hành (warranty) và các hành động được phép.")
        .Produces<GetPlacementDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // P06: POST /api/v1/placements/{placementId}/start-date-correction
        group.MapPost("/{placementId:guid}/start-date-correction", async (
            Guid placementId,
            [FromBody] CorrectPlacementStartDateRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isInternalHrOrAdmin = user.IsInRole("INTERNAL_HR") || user.IsInRole("PLATFORM_ADMIN");
            if (!isInternalHrOrAdmin)
            {
                return PermissionAuthorization.Forbidden("INTERNAL_HR | PLATFORM_ADMIN");
            }

            try
            {
                var response = await sender.Send(new CorrectPlacementStartDateCommand(
                    placementId,
                    request.ActualStartDate,
                    request.Reason,
                    userId.Value,
                    IsInternalHrOrAdmin: true), cancellationToken);
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message, errorCode = ex.ErrorCode });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message, errorCode = ex.ErrorCode });
            }
        })
        .WithName("CorrectPlacementStartDate")
        .WithSummary("Sửa ngày đi làm thực tế trong trường hợp nhập nhầm")
        .WithDescription("Chỉ Internal HR hoặc Platform Admin được sửa trong 7 ngày kể từ lúc xác nhận và trước khi phí dịch vụ được ghi nhận PAID. Hệ thống đồng thời dời hạn bảo hành và hạn thanh toán theo cùng số ngày.")
        .Produces<CorrectPlacementStartDateResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
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
}

public class CorrectPlacementStartDateRequest
{
    public DateOnly ActualStartDate { get; set; }
    public string Reason { get; set; } = string.Empty;
}
