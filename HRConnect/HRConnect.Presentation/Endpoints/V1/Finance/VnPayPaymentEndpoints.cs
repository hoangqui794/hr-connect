using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Payments;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Finance;

/// <summary>Client pays a fee on the Công nợ page through VNPay; the IPN marks it paid without Platform Admin.</summary>
public static class VnPayPaymentEndpoints
{
    public sealed record CreateVnPayPaymentRequest(string TargetType, Guid TargetId);

    public static IEndpointRouteBuilder MapVnPayPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/payments/vnpay").WithTags("Online Payments");

        group.MapGet("/status", ([FromServices] IVnPayGateway gateway) =>
                Results.Ok(new { success = true, data = new { enabled = gateway.IsEnabled } }))
            .RequireAuthorization()
            .WithName("GetVnPayStatus")
            .WithSummary("VNPay có đang bật không")
            .WithDescription("False khi chưa cấu hình VNPAY_TMN_CODE, VNPAY_HASH_SECRET và VNPAY_RETURN_URL; Client khi đó chỉ thấy hướng dẫn chuyển khoản.");

        group.MapPost("", async (
                [FromBody] CreateVnPayPaymentRequest body, ClaimsPrincipal user, HttpContext http, [FromServices] ISender sender, CancellationToken ct) =>
            {
                var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
                if (!Guid.TryParse(idClaim, out var userId))
                {
                    return Results.Unauthorized();
                }

                var ip = http.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "127.0.0.1";
                try
                {
                    var result = await sender.Send(
                        new CreateVnPayPaymentCommand(body.TargetType?.Trim().ToUpperInvariant() ?? "", body.TargetId, userId, ip), ct);
                    return Results.Ok(new { success = true, data = result });
                }
                catch (ForbiddenException ex)
                {
                    return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
                }
                catch (NotFoundException ex)
                {
                    return Results.NotFound(new { success = false, message = ex.Message });
                }
                catch (BadRequestException ex)
                {
                    return Results.BadRequest(new { success = false, message = ex.Message });
                }
            })
            .RequireAuthorization()
            .WithName("CreateVnPayPayment")
            .WithSummary("Tạo link thanh toán VNPay cho một khoản phí")
            .WithDescription("Client của doanh nghiệp sở hữu khoản phí. targetType SERVICE_FEE (targetId = serviceFeeId) hoặc POSTING_FEE (targetId = jobId). Lỗi 409: VNPAY_DISABLED, FEE_NOT_PAYABLE, VNPAY_UNSUPPORTED_AMOUNT.");

        // VNPay calls this server-to-server; the reply format is VNPay's, not our { success, data } envelope.
        group.MapGet("/ipn", async (HttpRequest request, [FromServices] ISender sender, [FromServices] ILoggerFactory loggers, CancellationToken ct) =>
            {
                try
                {
                    var result = await sender.Send(new ConfirmVnPayPaymentCommand(ReadQuery(request)), ct);
                    return IpnReply(result.RspCode, result.Message);
                }
                catch (Exception ex)
                {
                    // 99 makes VNPay retry the IPN later; the payment was put back to PENDING.
                    loggers.CreateLogger("VnPayIpn").LogError(ex, "VNPay IPN could not be applied.");
                    return IpnReply("99", "Unknown error");
                }
            })
            .AllowAnonymous()
            .WithName("VnPayIpn")
            .WithSummary("VNPay IPN: xác nhận kết quả thanh toán")
            .WithDescription("Kiểm chữ ký, số tiền, rồi ghi nhận khoản phí đã trả như Admin ghi nhận chuyển khoản (mã tham chiếu VNPAY-<mã giao dịch>).");

        // The frontend return page forwards VNPay's signed query here; it confirms too in case the IPN cannot reach us (local dev).
        group.MapGet("/return", async (HttpRequest request, [FromServices] ISender sender, CancellationToken ct) =>
            {
                var result = await sender.Send(new ConfirmVnPayPaymentCommand(ReadQuery(request)), ct);
                return result.Payment is null
                    ? Results.BadRequest(new { success = false, message = "Kết quả thanh toán không hợp lệ." })
                    : Results.Ok(new { success = true, data = result.Payment });
            })
            .AllowAnonymous()
            .WithName("VnPayReturn")
            .WithSummary("Kết quả thanh toán VNPay cho trang quay về của Client");

        return app;
    }

    // VNPay reads "RspCode" / "Message" exactly as written, so skip the app's camelCase JSON naming.
    private static readonly System.Text.Json.JsonSerializerOptions VnPayJson = new();

    private static IResult IpnReply(string rspCode, string message) =>
        Results.Json(new { RspCode = rspCode, Message = message }, VnPayJson);

    private static IReadOnlyDictionary<string, string> ReadQuery(HttpRequest request) =>
        request.Query.ToDictionary(q => q.Key, q => q.Value.ToString(), StringComparer.Ordinal);
}
