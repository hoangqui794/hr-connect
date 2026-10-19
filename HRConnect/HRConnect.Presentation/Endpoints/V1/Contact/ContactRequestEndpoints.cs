using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Contact;
using HRConnect.Presentation.Authorization;
using HRConnect.Presentation.RateLimiting;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Contact;

/// <summary>BE-04 A: public contact form and the operations queue that follows it up.</summary>
public static class ContactRequestEndpoints
{
    private const string ContactManage = "contact_request.manage";

    public sealed record SubmitContactRequest(
        string FullName, string Email, string? Phone, string? CompanyName, string ServiceInterest, string Message, bool ConsentAccepted);

    public sealed record UpdateContactRequest(string Status, string? Note);

    public static IEndpointRouteBuilder MapContactRequestEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/public/contact-requests", async (
                [FromBody] SubmitContactRequest body, HttpContext http, [FromServices] ISender sender, CancellationToken ct) =>
            {
                try
                {
                    var receipt = await sender.Send(new SubmitContactRequestCommand(
                        body.FullName, body.Email, body.Phone, body.CompanyName, body.ServiceInterest, body.Message,
                        body.ConsentAccepted, RateLimitIdentity.Ip(http)), ct);
                    return Results.Ok(new { success = true, data = receipt });
                }
                catch (TooManyRequestsException ex)
                {
                    return Results.Json(new { success = false, code = ex.ErrorCode, message = ex.Message }, statusCode: StatusCodes.Status429TooManyRequests);
                }
                catch (BadRequestException ex)
                {
                    return Results.BadRequest(new { success = false, code = ex.ErrorCode, message = ex.Message });
                }
            })
            .AllowAnonymous()
            .RequireRateLimiting("public-read")
            .WithTags("Contact")
            .WithName("SubmitContactRequest")
            .WithSummary("Khách gửi form liên hệ tư vấn")
            .WithDescription("Không cần đăng nhập. consentAccepted phải là true (đồng ý xử lý dữ liệu cá nhân, Nghị định 13/2023), nếu không trả 400 CONSENT_REQUIRED. serviceInterest: HEADHUNT_COD, CV_SOURCING, CV_APPLICATION, OTHER. Mỗi IP gửi tối đa contact.rate_limit_per_hour lần mỗi giờ (mặc định 5), vượt thì 429 CONTACT_RATE_LIMITED. Gửi email báo tới CONTACT_NOTIFY_EMAIL nếu có cấu hình.");

        var admin = app.MapGroup("/api/v1/admin/contact-requests").WithTags("Contact").RequireAuthorization();

        admin.MapGet("", (
                ClaimsPrincipal user, [FromServices] ISender sender, [FromQuery] string? status, CancellationToken ct,
                [FromQuery] int page = 1, [FromQuery] int pageSize = 20) =>
            Execute(user, _ => sender.Send(new GetContactRequestsQuery(status, page, pageSize), ct)))
            .WithName("GetContactRequests")
            .WithSummary("Danh sách yêu cầu liên hệ")
            .WithDescription("Yêu cầu mới lên đầu, cũ trước. Lọc status: NEW, CONTACTED, CLOSED. Quyền contact_request.manage (Platform Admin, Internal HR).");

        admin.MapPatch("/{contactRequestId:guid}", (
                Guid contactRequestId, [FromBody] UpdateContactRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            Execute(user, userId => sender.Send(new UpdateContactRequestCommand(contactRequestId, body.Status, body.Note, userId), ct)))
            .WithName("UpdateContactRequest")
            .WithSummary("Cập nhật trạng thái yêu cầu liên hệ")
            .WithDescription("status: NEW, CONTACTED, CLOSED; note tùy chọn. Ghi audit. Quyền contact_request.manage.");

        return app;
    }

    private static async Task<IResult> Execute<T>(ClaimsPrincipal user, Func<Guid, Task<T>> action)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(idClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        if (!user.IsInRole("PLATFORM_ADMIN") && !PermissionAuthorization.HasPermission(user, ContactManage))
        {
            return PermissionAuthorization.Forbidden(ContactManage);
        }

        try
        {
            return Results.Ok(new { success = true, data = await action(userId) });
        }
        catch (NotFoundException ex)
        {
            return Results.NotFound(new { success = false, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return Results.BadRequest(new { success = false, code = ex.ErrorCode, message = ex.Message });
        }
    }
}
