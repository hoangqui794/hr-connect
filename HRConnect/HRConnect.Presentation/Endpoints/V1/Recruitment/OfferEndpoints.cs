using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Offers.Commands.UpdateOfferDraft;
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
    private const string UpdatePermission = "offer.update";
    private const string SendPermission = "offer.send";
    private const string RespondPermission = "offer.respond";
    private const string WithdrawPermission = "offer.withdraw";

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

        // O04: PUT /api/v1/offers/{offerId:guid}
        group.MapPut("/{offerId:guid}", async (
            Guid offerId,
            [FromBody] UpdateOfferDraftRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, UpdatePermission);
            var isInternal = PermissionAuthorization.HasPermission(user, ManagePermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(UpdatePermission);
            }

            try
            {
                var command = new UpdateOfferDraftCommand(
                    OfferId: offerId,
                    Salary: request.Salary,
                    CurrencyCode: request.CurrencyCode,
                    StartDate: request.StartDate,
                    ExpiryDate: request.ExpiryDate,
                    OfferDocumentUrl: request.OfferDocumentUrl,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: isClient && !isInternal && !isAdmin,
                    IsInternalHrOrAdmin: isInternal || isAdmin
                );

                var response = await sender.Send(command, cancellationToken);
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
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("UpdateOfferDraft")
        .WithSummary("Chỉnh sửa thư mời nhận việc bản nháp (Update Offer Draft)")
        .WithDescription("Dành cho Client Company HR / Admin (offer.update) hoặc Internal HR / Admin (offer.manage). Chỉ có thể chỉnh sửa khi offer đang ở trạng thái DRAFT.")
        .Produces<UpdateOfferDraftResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

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

public class UpdateOfferDraftRequest
{
    public decimal? Salary { get; set; }
    public string? CurrencyCode { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? OfferDocumentUrl { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}
