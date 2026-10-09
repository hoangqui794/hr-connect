using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Finance.Commands.WarrantyClaims;
using HRConnect.Application.Features.Finance.Queries;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Finance;

/// <summary>
/// MF-05 (HEADHUNT_COD): service fees, warranty claims, commissions and payouts.
/// Commission is earned in full when the candidate has worked through the 30-day warranty,
/// and is approved for payment only after the Client has paid the service fee.
/// </summary>
public static class FinanceEndpoints
{
    private const string PlacementConfirm = "placement.confirm";
    private const string WarrantyManage = "warranty.manage";
    private const string CommissionView = "commission.view";
    private const string CommissionViewOwn = "commission.view_own";
    private const string CommissionManage = "commission.manage";
    private const string PayoutView = "payout.view";
    private const string PayoutViewOwn = "payout.view_own";
    private const string PayoutManage = "payout.manage";

    public sealed record ReportResignationRequest(DateOnly LastWorkingDate, string Reason);
    public sealed record ResolveResignationRequest(bool Confirmed, string? Note);
    public sealed record RecordServiceFeePaymentRequest(DateTime PaidAt, string PaymentReference);
    public sealed record ReasonRequest(string Reason);
    public sealed record AdjustCommissionRequest(decimal NewAmount, string Reason);
    public sealed record RecordPayoutRequest(bool Succeeded, DateTime PayoutDate, string? Method, string? TransactionReference, string? EvidenceUrl);

    public static IEndpointRouteBuilder MapFinanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1").WithTags("MF-05 Finance").RequireAuthorization();

        group.MapPost("/placements/{placementId:guid}/resignation", (
                Guid placementId, [FromBody] ReportResignationRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [PlacementConfirm], userId => sender.Send(
                new ReportResignationCommand(placementId, body.LastWorkingDate, body.Reason, userId), ct)))
            .WithName("ReportPlacementResignation")
            .WithSummary("Client báo ứng viên nghỉ việc trong thời hạn bảo hành")
            .WithDescription("Bảo hành chuyển CLAIMED, hoa hồng PENDING tạm giữ (ON_HOLD) chờ Internal HR xác minh. Chỉ Client sở hữu Job (placement.confirm).");

        group.MapPost("/placements/{placementId:guid}/resignation/resolve", (
                Guid placementId, [FromBody] ResolveResignationRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [WarrantyManage], userId => sender.Send(
                new ResolveResignationCommand(placementId, body.Confirmed, body.Note, userId), ct)))
            .WithName("ResolvePlacementResignation")
            .WithSummary("Internal HR xác minh báo nghỉ việc")
            .WithDescription("Xác nhận: bảo hành VOIDED, hoa hồng CANCELLED, Client được tuyển thay thế. Bác bỏ (cần ghi chú): bảo hành ACTIVE, hoa hồng PENDING. Quyền warranty.manage.");

        group.MapGet("/service-fees", (
                ClaimsPrincipal user, [FromServices] ISender sender, [FromQuery] string? status, CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
            Execute(user, [CommissionManage, CommissionView, PlacementConfirm], userId =>
            {
                // Platform roles see every fee; a Client sees only its own company's fees.
                var platform = Has(user, CommissionManage) || Has(user, CommissionView);
                return sender.Send(new GetServiceFeesQuery(platform ? null : userId, status, page, pageSize), ct);
            }))
            .WithName("GetServiceFees")
            .WithSummary("Danh sách công nợ phí dịch vụ HEADHUNT_COD")
            .WithDescription("Admin/Internal HR xem tất cả; Client (placement.confirm) chỉ xem công nợ của doanh nghiệp mình. Lọc theo status: PENDING, PAID, OVERDUE, CANCELLED.");

        group.MapPost("/admin/service-fees/{serviceFeeId:guid}/record-payment", (
                Guid serviceFeeId, [FromBody] RecordServiceFeePaymentRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [CommissionManage], userId => sender.Send(
                new RecordServiceFeePaymentCommand(serviceFeeId, body.PaidAt, body.PaymentReference, userId), ct)))
            .WithName("RecordServiceFeePayment")
            .WithSummary("Admin ghi nhận Client đã thanh toán phí dịch vụ")
            .WithDescription("Chuyển công nợ PENDING/OVERDUE sang PAID kèm ngày và mã tham chiếu chuyển khoản. Quyền commission.manage.");

        group.MapGet("/commissions", (
                ClaimsPrincipal user, [FromServices] ISender sender, [FromQuery] string? status, CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
            Execute(user, [CommissionManage, CommissionView, CommissionViewOwn], userId =>
            {
                var platform = Has(user, CommissionManage) || Has(user, CommissionView);
                return sender.Send(new GetCommissionsQuery(platform ? null : userId, status, page, pageSize), ct);
            }))
            .WithName("GetCommissions")
            .WithSummary("Danh sách hoa hồng Affiliate")
            .WithDescription("Admin/Internal HR xem tất cả; Affiliate (commission.view_own) chỉ xem hoa hồng của mình. Trạng thái: PENDING, EARNED, PAYABLE, PAID, ON_HOLD, CANCELLED.");

        group.MapPost("/admin/commissions/{commissionId:guid}/approve", (
                Guid commissionId, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [CommissionManage], userId => sender.Send(new ApproveCommissionCommand(commissionId, userId), ct)))
            .WithName("ApproveCommission")
            .WithSummary("Admin duyệt hoa hồng để chi trả")
            .WithDescription("EARNED → PAYABLE. Từ chối (409 SERVICE_FEE_NOT_PAID) khi Client chưa thanh toán phí dịch vụ. Quyền commission.manage.");

        group.MapPost("/admin/commissions/{commissionId:guid}/cancel", (
                Guid commissionId, [FromBody] ReasonRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [CommissionManage], userId => sender.Send(new CancelCommissionCommand(commissionId, body.Reason, userId), ct)))
            .WithName("CancelCommission")
            .WithSummary("Admin hủy hoa hồng (bắt buộc lý do)");

        group.MapPost("/admin/commissions/{commissionId:guid}/adjust", (
                Guid commissionId, [FromBody] AdjustCommissionRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [CommissionManage], userId => sender.Send(new AdjustCommissionCommand(commissionId, body.NewAmount, body.Reason, userId), ct)))
            .WithName("AdjustCommission")
            .WithSummary("Admin điều chỉnh số tiền hoa hồng trước khi chi")
            .WithDescription("Lưu số cũ, số mới, lý do và người điều chỉnh vào commission_adjustment.");

        group.MapPost("/admin/commissions/{commissionId:guid}/payouts", (
                Guid commissionId, [FromBody] RecordPayoutRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, [PayoutManage], userId => sender.Send(new RecordPayoutCommand(
                commissionId, body.Succeeded, body.PayoutDate, body.Method, body.TransactionReference, body.EvidenceUrl, userId), ct)))
            .WithName("RecordPayout")
            .WithSummary("Admin ghi nhận chi hoa hồng (chuyển khoản ngoài hệ thống)")
            .WithDescription("Chỉ cho hoa hồng PAYABLE. Thành công: payout COMPLETED, hoa hồng PAID. Thất bại: payout FAILED, hoa hồng giữ PAYABLE để chi lại. Quyền payout.manage.");

        group.MapGet("/payouts", (
                ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
            Execute(user, [PayoutManage, PayoutView, PayoutViewOwn], userId =>
            {
                var platform = Has(user, PayoutManage) || Has(user, PayoutView);
                return sender.Send(new GetPayoutsQuery(platform ? null : userId, page, pageSize), ct);
            }))
            .WithName("GetPayouts")
            .WithSummary("Lịch sử payout")
            .WithDescription("Admin/Internal HR xem tất cả; Affiliate (payout.view_own) chỉ xem payout của mình.");

        return app;
    }

    private static bool Has(ClaimsPrincipal user, string permission) =>
        user.IsInRole("PLATFORM_ADMIN") && permission is CommissionManage or PayoutManage
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
            return Results.BadRequest(new { success = false, message = ex.Message });
        }
    }
}
