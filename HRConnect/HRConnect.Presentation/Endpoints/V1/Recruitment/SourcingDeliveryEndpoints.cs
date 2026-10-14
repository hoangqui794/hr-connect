using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Sourcing;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Recruitment;

/// <summary>
/// MF-03 (CV_SOURCING): Internal HR hands qualified CVs to the Client, the Client accepts or
/// rejects each one within the review window, and an unanswered CV counts as accepted.
/// </summary>
public static class SourcingDeliveryEndpoints
{
    private const string ScreenPermission = "application.screen";
    private const string ReviewCompanyPermission = "candidate.review_company";

    public sealed record DeliverRequest(IReadOnlyList<Guid> ApplicationIds);
    public sealed record DecisionRequest(string Decision, string? ReasonCode, string? Note);
    public sealed record ReviewRejectionRequest(bool Upheld, string? Note);
    public sealed record ReplaceRequest(Guid ApplicationId);

    public static IEndpointRouteBuilder MapSourcingDeliveryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/jobs/{jobId:guid}/sourcing/deliveries")
            .WithTags("MF-03 CV Sourcing")
            .RequireAuthorization();

        group.MapPost("", (Guid jobId, [FromBody] DeliverRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ScreenPermission], userId => sender.Send(new DeliverSourcingCvsCommand(jobId, body.ApplicationIds, userId), ct)))
            .WithName("DeliverSourcingCvs")
            .WithSummary("Internal HR giao CV đạt yêu cầu cho Client")
            .WithDescription("Hồ sơ phải SHORTLISTED và ứng viên đã xác nhận consent; tổng CV đang giữ chỗ không vượt Sourcing Target. Mở thời hạn xem xét (mặc định 7 ngày). Quyền application.screen.");

        group.MapPost("/{deliveryId:guid}/decision", (Guid jobId, Guid deliveryId, [FromBody] DecisionRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ReviewCompanyPermission], userId => sender.Send(
                    new DecideSourcingDeliveryCommand(jobId, deliveryId, body.Decision, body.ReasonCode, body.Note, userId), ct)))
            .WithName("DecideSourcingDelivery")
            .WithSummary("Client chấp nhận hoặc từ chối CV đã giao")
            .WithDescription("REJECTED bắt buộc reasonCode: DUPLICATE_ALREADY_OWNED, FALSE_INFORMATION, UNREACHABLE, WRONG_JOB, OTHER (OTHER cần ghi chú). Không chọn phỏng vấn không phải lý do từ chối. Quá hạn xem xét trả 409 REVIEW_WINDOW_CLOSED.");

        group.MapPost("/{deliveryId:guid}/review-rejection", (Guid jobId, Guid deliveryId, [FromBody] ReviewRejectionRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ScreenPermission], userId => sender.Send(
                    new ReviewSourcingRejectionCommand(jobId, deliveryId, body.Upheld, body.Note, userId), ct)))
            .WithName("ReviewSourcingRejection")
            .WithSummary("Internal HR xác minh lý do Client từ chối CV")
            .WithDescription("upheld=true giữ từ chối; upheld=false (cần ghi chú) chuyển CV sang ACCEPTED để tính tiền.");

        group.MapPost("/{deliveryId:guid}/replace", (Guid jobId, Guid deliveryId, [FromBody] ReplaceRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Execute(user, [ScreenPermission], userId => sender.Send(
                    new ReplaceSourcingDeliveryCommand(jobId, deliveryId, body.ApplicationId, userId), ct)))
            .WithName("ReplaceSourcingDelivery")
            .WithSummary("Internal HR thay CV bị từ chối bằng CV đạt yêu cầu khác")
            .WithDescription("CV cũ chuyển REPLACED; CV mới DELIVERED với thời hạn xem xét mới.");

        group.MapGet("", (Guid jobId, ClaimsPrincipal user, [FromServices] ISender sender, [FromQuery] string? status, CancellationToken ct) =>
                Execute(user, [ScreenPermission, ReviewCompanyPermission], userId => sender.Send(
                    new GetSourcingDeliveriesQuery(jobId, PermissionAuthorization.HasPermission(user, ScreenPermission) ? null : userId, status), ct)))
            .WithName("GetSourcingDeliveries")
            .WithSummary("Danh sách CV đã giao của job CV_SOURCING và tiến độ")
            .WithDescription("Client chỉ xem job của công ty mình; Internal HR xem tất cả.");

        return app;
    }

    /// <summary>Checks that the caller has any of the permissions, then maps domain exceptions to HTTP results.</summary>
    private static async Task<IResult> Execute<T>(ClaimsPrincipal user, string[] anyOf, Func<Guid, Task<T>> action)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(idClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        if (!anyOf.Any(permission => PermissionAuthorization.HasPermission(user, permission)))
        {
            return PermissionAuthorization.Forbidden(string.Join(" | ", anyOf));
        }

        try
        {
            return Results.Ok(new { success = true, data = await action(userId) });
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
            return Results.Conflict(new { success = false, errorCode = ex.ErrorCode, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return Results.BadRequest(new { success = false, message = ex.Message });
        }
    }
}
