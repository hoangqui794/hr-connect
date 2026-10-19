using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Disputes;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Disputes;

/// <summary>
/// SF-04 (minimal scope): an affiliate disputes a blocked duplicate submission or another affiliate's
/// attribution; Platform Admin reviews the evidence and decides. UPHELD moves the attribution.
/// </summary>
public static class DisputeEndpoints
{
    private const string DisputeCreate = "dispute.create";
    private const string DisputeViewOwn = "dispute.view_own";
    private const string DisputeView = "dispute.view";
    private const string DisputeResolve = "dispute.resolve";

    public sealed record CreateDisputeRequest(string DisputeType, Guid SubmissionId, string Description, string? EvidenceNote);
    public sealed record ResolveDisputeRequest(string Decision, string Resolution);

    public static IEndpointRouteBuilder MapDisputeEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1").WithTags("SF-04 Disputes").RequireAuthorization();

        group.MapPost("/disputes", (
                [FromBody] CreateDisputeRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [DisputeCreate], userId => sender.Send(
                new CreateDisputeCommand(userId, body.DisputeType, body.SubmissionId, body.Description, body.EvidenceNote), ct)))
            .WithName("CreateDispute")
            .WithSummary("Affiliate gửi khiếu nại trùng ứng viên hoặc attribution")
            .WithDescription("disputeType: DUPLICATE_SUBMISSION (lượt nộp của mình bị BLOCKED_DUPLICATE) hoặc ATTRIBUTION (ứng viên đang được ghi nhận cho Affiliate khác). submissionId là lượt nộp của chính mình. Hạn khiếu nại: dispute.window_days (mặc định 30) kể từ lúc bị chặn / lúc ứng viên đi làm. Lỗi: 400 DISPUTE_NOT_ELIGIBLE, 409 DISPUTE_ALREADY_OPEN, 409 DISPUTE_WINDOW_CLOSED. Quyền dispute.create.");

        group.MapGet("/disputes/mine", (
                ClaimsPrincipal user, [FromServices] ISender sender, [FromQuery] string? status, CancellationToken ct) =>
            Execute(user, [DisputeViewOwn], userId => sender.Send(new GetMyDisputesQuery(userId, status), ct)))
            .WithName("GetMyDisputes")
            .WithSummary("Khiếu nại của tôi")
            .WithDescription("Không trả tên hay mã Affiliate bên kia, chỉ trả kết quả và lý do Admin ghi. Quyền dispute.view_own.");

        group.MapGet("/admin/disputes", (
                ClaimsPrincipal user, [FromServices] ISender sender, [FromQuery] string? status, [FromQuery] string? type,
                CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
            Execute(user, [DisputeView], _ => sender.Send(new GetAdminDisputesQuery(status, type, page, pageSize), ct)))
            .WithName("GetAdminDisputes")
            .WithSummary("Hàng chờ khiếu nại cho Platform Admin")
            .WithDescription("Khiếu nại đang mở lên đầu, cũ trước. Lọc status (OPEN, UPHELD, REJECTED), type. Quyền dispute.view.");

        group.MapGet("/admin/disputes/{disputeId:guid}", (
                Guid disputeId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [DisputeView], _ => sender.Send(new GetAdminDisputeDetailQuery(disputeId), ct)))
            .WithName("GetAdminDisputeDetail")
            .WithSummary("Chi tiết khiếu nại để xử lý")
            .WithDescription("Danh tính ứng viên (email / SĐT đã chuẩn hóa), mọi lượt nộp của ứng viên vào job (Affiliate, thời điểm, consent), attribution hiện tại, hoa hồng liên quan, bằng chứng. Quyền dispute.view.");

        group.MapPost("/admin/disputes/{disputeId:guid}/resolve", (
                Guid disputeId, [FromBody] ResolveDisputeRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [DisputeResolve], userId => sender.Send(
                new ResolveDisputeCommand(disputeId, body.Decision, body.Resolution, userId), ct)))
            .WithName("ResolveDispute")
            .WithSummary("Platform Admin xử lý khiếu nại")
            .WithDescription("decision: UPHELD (chuyển attribution sang Affiliate khiếu nại, hoa hồng chưa chi đi theo) hoặc REJECTED (giữ nguyên). resolution bắt buộc. Có audit và thông báo. Lỗi: 409 DISPUTE_NOT_OPEN; 409 DISPUTE_COMMISSION_ALREADY_PAID khi hoa hồng đã chi. Quyền dispute.resolve.");

        return app;
    }

    private static bool Has(ClaimsPrincipal user, string permission) =>
        user.IsInRole("PLATFORM_ADMIN") && permission is DisputeView or DisputeResolve
        || PermissionAuthorization.HasPermission(user, permission);

    /// <summary>Checks that the caller has any of the permissions, then maps domain exceptions to HTTP results.</summary>
    private static async Task<IResult> Execute<T>(ClaimsPrincipal user, string[] anyOf, Func<Guid, Task<T>> action)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(idClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        if (!anyOf.Any(permission => Has(user, permission)))
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
            return Results.Conflict(new { success = false, code = ex.ErrorCode, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return Results.BadRequest(new { success = false, code = ex.ErrorCode, message = ex.Message });
        }
    }
}
