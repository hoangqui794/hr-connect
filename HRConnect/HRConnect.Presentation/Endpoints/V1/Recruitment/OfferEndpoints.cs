using System;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Offers.Commands.RespondToOffer;
using HRConnect.Application.Features.Offers.Commands.SendOffer;
using HRConnect.Application.Features.Offers.Commands.UpdateOfferDraft;
using HRConnect.Application.Features.Offers.Commands.WithdrawOffer;
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
    private const string InternalViewPermission = "application.view";
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
            var isInternal = PermissionAuthorization.HasPermission(user, InternalViewPermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(InternalViewPermission);
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
        .WithDescription("Hỗ trợ lọc theo applicationId, candidateId, jobId, status và phân trang. Yêu cầu quyền offer.view_company (Client Company), offer.view_own (Candidate), hoặc application.view (Internal HR/Admin).")
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
            var isInternal = PermissionAuthorization.HasPermission(user, InternalViewPermission);
            var isCandidate = PermissionAuthorization.HasPermission(user, ViewOwnPermission);
            var isAdmin = user.IsInRole("PLATFORM_ADMIN");

            if (!isClient && !isInternal && !isCandidate && !isAdmin)
            {
                return PermissionAuthorization.Forbidden(InternalViewPermission);
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
        .WithDescription("Yêu cầu quyền offer.view_company (Client Company), offer.view_own (Candidate - chỉ xem được offer đã gửi), hoặc application.view (Internal HR/Admin). Trả về thông tin đầy đủ về mức đãi ngộ, phê duyệt, tài liệu đính kèm và hợp đồng nhận việc.")
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

            if (!isClient)
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
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithDescription("Chỉ Client Company sở hữu Job với quyền offer.update được sửa offer ở trạng thái DRAFT.")
        .Produces<UpdateOfferDraftResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // O05: POST /api/v1/offers/{offerId:guid}/send
        group.MapPost("/{offerId:guid}/send", async (
            Guid offerId,
            [FromBody] SendOfferRequest? request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, SendPermission);

            if (!isClient)
            {
                return PermissionAuthorization.Forbidden(SendPermission);
            }

            try
            {
                var command = new SendOfferCommand(
                    OfferId: offerId,
                    ConcurrencyToken: request?.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithName("SendOffer")
        .WithSummary("Gửi thư mời nhận việc cho ứng viên (Send Offer)")
        .WithDescription("Chỉ Client Company sở hữu Job với quyền offer.send được gửi offer. API chuyển offer từ DRAFT sang SENT; việc phát thông báo tới ứng viên được xử lý ở hạng mục notification riêng.")
        .Produces<SendOfferResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // O06: POST /api/v1/offers/{offerId:guid}/response
        group.MapPost("/{offerId:guid}/response", async (
            Guid offerId,
            [FromBody] RespondToOfferRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, RespondPermission))
            {
                return PermissionAuthorization.Forbidden(RespondPermission);
            }

            try
            {
                var command = new RespondToOfferCommand(
                    OfferId: offerId,
                    Response: request.Response,
                    DeclineReason: request.DeclineReason,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value
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
        .WithName("RespondToOffer")
        .WithSummary("Ứng viên phản hồi lời mời nhận việc (Accept/Decline Offer)")
        .WithDescription("Dành cho ứng viên sở hữu offer (quyền offer.respond). Ứng viên có thể chấp nhận (ACCEPTED) hoặc từ chối (DECLINED kèm lý do).")
        .Produces<RespondToOfferResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // O07: POST /api/v1/offers/{offerId:guid}/withdraw
        group.MapPost("/{offerId:guid}/withdraw", async (
            Guid offerId,
            [FromBody] WithdrawOfferRequest request,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            var isClient = PermissionAuthorization.HasPermission(user, WithdrawPermission);

            if (!isClient)
            {
                return PermissionAuthorization.Forbidden(WithdrawPermission);
            }

            try
            {
                var command = new WithdrawOfferCommand(
                    OfferId: offerId,
                    Reason: request.Reason,
                    ConcurrencyToken: request.ConcurrencyToken,
                    CurrentUserId: userId.Value,
                    IsClientCompanyUser: true,
                    IsInternalHrOrAdmin: false
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
        .WithName("WithdrawOffer")
        .WithSummary("Thu hồi thư mời nhận việc (Withdraw Offer)")
        .WithDescription("Chỉ Client Company sở hữu Job với quyền offer.withdraw được thu hồi offer chưa được chấp nhận. Hồ sơ giữ ở OFFER_PENDING để Company có thể phát hành offer thay thế.")
        .Produces<WithdrawOfferResponse>(StatusCodes.Status200OK)
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

public class SendOfferRequest
{
    public Guid? ConcurrencyToken { get; set; }
}

public class RespondToOfferRequest
{
    public string Response { get; set; } = string.Empty;
    public string? DeclineReason { get; set; }
    public Guid? ConcurrencyToken { get; set; }
}

public class WithdrawOfferRequest
{
    public string Reason { get; set; } = string.Empty;
    public Guid? ConcurrencyToken { get; set; }
}
