using HRConnect.Application.Common.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Emails;

public static class EmailEndpoints
{
    public static IEndpointRouteBuilder MapEmailEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/emails")
                       .WithTags("Emails");

        group.MapPost("/test-send", async (
            [FromBody] SendTestEmailRequest request,
            [FromServices] IEmailService emailService,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(request.To))
            {
                return Results.BadRequest(new { message = "Email người nhận không được để trống." });
            }

            var subject = string.IsNullOrWhiteSpace(request.Subject)
                ? "Thư kiểm tra từ HR Connect System"
                : request.Subject;

            var bodyHtml = string.IsNullOrWhiteSpace(request.BodyHtml)
                ? "<div style='font-family: Arial, sans-serif; padding: 20px; color: #333;'><h2 style='color: #4F46E5;'>HR Connect System</h2><p>Xin chào!</p><p>Đây là email kiểm tra được gửi tự động từ hệ thống <strong>HR Connect</strong> thông qua dịch vụ <strong>Resend</strong>.</p><hr style='border: none; border-top: 1px solid #eee;' /><p style='font-size: 12px; color: #888;'>Thông báo tự động từ HR Connect System. Vui lòng không trả lời thư này.</p></div>"
                : request.BodyHtml;

            var result = await emailService.SendEmailAsync(request.To, subject, bodyHtml, cancellationToken);

            if (result.IsSuccess)
            {
                return Results.Ok(new
                {
                    success = true,
                    message = "Gửi email thành công qua Resend!",
                    messageId = result.MessageId
                });
            }

            return Results.BadRequest(new
            {
                success = false,
                message = "Không thể gửi email qua Resend.",
                error = result.ErrorMessage,
                note = "Lưu ý: Khi dùng domain mặc định (onboarding@resend.dev) trên tài khoản Resend Free, bạn chỉ có thể gửi đến chính email bạn đã đăng ký tài khoản Resend."
            });
        })
        .WithName("SendTestEmail")
        .WithSummary("Gửi email thử nghiệm qua dịch vụ Resend")
        .WithDescription("Dùng để kiểm tra cấu hình Resend API Key. Hỗ trợ gửi HTML email.");

        return app;
    }
}

public record SendTestEmailRequest(string To, string? Subject, string? BodyHtml);
