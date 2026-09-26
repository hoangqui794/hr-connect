using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Offers.Queries.GetOffers;
using HRConnect.Application.Features.Offers.Queries.GetOfferDetail;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

public static class OfferEndpoints
{
    private const string ViewCompanyPermission = "offer.view_company";
    private const string ViewOwnPermission = "offer.view_own";
    private const string ManagePermission = "offer.manage";

    public static IEndpointRouteBuilder MapOfferEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/offers")
            .WithTags("Offers")
            .RequireAuthorization();

        // O01: GET /api/v1/offers
        group.MapGet("/", async (
            [FromQuery] Guid? applicationId,
            [FromQuery] Guid? candidateId,
            [FromQuery] Guid? jobId,
            [FromQuery] string? status,
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
                var query = new GetOffersQuery(
                    CurrentUserId: userId.Value,
                    ApplicationId: applicationId,
                    CandidateId: candidateId,
                    JobId: jobId,
                    Status: status,
                    Page: page,
                    PageSize: pageSize,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    IsCandidate: isCandidate && !isClient && !isInternal && !isAdmin
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
        .WithName("GetOffers")
        .WithSummary("Lấy danh sách lời mời nhận việc (Offers)")
        .WithDescription("Hỗ trợ lọc theo applicationId, candidateId, jobId, status và phân trang. Yêu cầu quyền offer.view_company (Client Company), offer.view_own (Candidate), hoặc offer.manage (Internal HR/Admin).")
        .Produces<GetOffersResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        // O02: GET /api/v1/offers/{offerId:guid}
        group.MapGet("/{offerId:guid}", async (
            Guid offerId,
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
                var query = new GetOfferDetailQuery(
                    offerId,
                    userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin,
                    IsCandidate: isCandidate && !isClient && !isInternal && !isAdmin
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
        .WithName("GetOfferDetail")
        .WithSummary("Lấy thông tin chi tiết một lời mời nhận việc (Offer)")
        .WithDescription("Yêu cầu quyền offer.view_company (Client Company), offer.view_own (Candidate - chỉ xem được offer đã gửi), hoặc offer.manage (Internal HR/Admin). Trả về thông tin đầy đủ về mức đãi ngộ, phê duyệt, tài liệu đính kèm và hợp đồng nhận việc.")
        .Produces<GetOfferDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static Guid? GetUserIdFromClaims(ClaimsPrincipal user)
    {
        var rawId = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? user.FindFirstValue("userId");

        return Guid.TryParse(rawId, out var parsed) ? parsed : null;
    }
}
