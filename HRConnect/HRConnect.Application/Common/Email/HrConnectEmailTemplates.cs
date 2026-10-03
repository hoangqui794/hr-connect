using System.Net;

namespace HRConnect.Application.Common.Email;

public sealed record HrConnectEmail(string Subject, string HtmlBody);

/// <summary>
/// Centralized transactional email templates. All dynamic content is HTML encoded here.
/// </summary>
public static class HrConnectEmailTemplates
{
    private const string Brand = "HR Connect";

    public static HrConnectEmail RegistrationOtp(
        string recipientName,
        string otp,
        int expirationMinutes,
        string accountLabel,
        bool requiresAdminApproval)
    {
        var nextStep = requiresAdminApproval
            ? "Sau khi xác thực email, hồ sơ đăng ký sẽ được chuyển đến Ban quản trị để xem xét."
            : "Sau khi xác thực email, bạn có thể tiếp tục hoàn thiện hồ sơ và sử dụng HR Connect.";

        return new HrConnectEmail(
            "Mã xác thực tài khoản HR Connect",
            Render(
                "Xác thực địa chỉ email",
                Greeting(recipientName) +
                $"<p style=\"margin:0 0 16px\">Bạn đang hoàn tất đăng ký <strong>{E(accountLabel)}</strong> trên HR Connect. Nhập mã dưới đây để xác thực email:</p>" +
                OtpBox(otp) +
                $"<p style=\"margin:0 0 16px\">Mã có hiệu lực trong <strong>{expirationMinutes} phút</strong>. {nextStep}</p>" +
                SecurityNote("Không chia sẻ mã này với bất kỳ ai, kể cả người tự nhận là nhân viên HR Connect."),
                $"Mã xác thực có hiệu lực trong {expirationMinutes} phút."));
    }

    public static HrConnectEmail RegistrationOtpResent(
        string recipientName,
        string otp,
        int expirationMinutes)
    {
        return new HrConnectEmail(
            "Mã xác thực mới cho tài khoản HR Connect",
            Render(
                "Mã xác thực mới",
                Greeting(recipientName) +
                "<p style=\"margin:0 0 16px\">Theo yêu cầu của bạn, HR Connect đã tạo một mã xác thực mới:</p>" +
                OtpBox(otp) +
                $"<p style=\"margin:0 0 16px\">Mã có hiệu lực trong <strong>{expirationMinutes} phút</strong>. Các mã được gửi trước đó không còn hiệu lực.</p>" +
                SecurityNote("Nếu bạn không yêu cầu mã mới, bạn có thể bỏ qua email này."),
                $"Mã xác thực mới có hiệu lực trong {expirationMinutes} phút."));
    }

    public static HrConnectEmail PasswordResetOtp(
        string recipientName,
        string otp,
        int expirationMinutes,
        bool isResend)
    {
        var intro = isResend
            ? "Theo yêu cầu của bạn, HR Connect đã tạo một mã đặt lại mật khẩu mới:"
            : "HR Connect nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Dùng mã dưới đây để tiếp tục:";

        return new HrConnectEmail(
            "Mã xác thực đặt lại mật khẩu HR Connect",
            Render(
                "Đặt lại mật khẩu",
                Greeting(recipientName) +
                $"<p style=\"margin:0 0 16px\">{intro}</p>" +
                OtpBox(otp) +
                $"<p style=\"margin:0 0 16px\">Mã có hiệu lực trong <strong>{expirationMinutes} phút</strong>.{(isResend ? " Các mã được gửi trước đó không còn hiệu lực." : string.Empty)}</p>" +
                SecurityNote("Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này và không cung cấp mã cho người khác."),
                $"Mã đặt lại mật khẩu có hiệu lực trong {expirationMinutes} phút."));
    }

    public static HrConnectEmail RegistrationUnderReview(string accountLabel)
    {
        return new HrConnectEmail(
            $"HR Connect đã tiếp nhận hồ sơ {accountLabel}",
            Render(
                "Hồ sơ đã được tiếp nhận",
                $"<p style=\"margin:0 0 16px\">Email của bạn đã được xác thực thành công. Hồ sơ đăng ký <strong>{E(accountLabel)}</strong> hiện đang được Ban quản trị xem xét.</p>" +
                "<p style=\"margin:0\">HR Connect sẽ gửi kết quả đến địa chỉ email này ngay sau khi quá trình xét duyệt hoàn tất.</p>",
                "Email đã được xác thực. Hồ sơ đang chờ xét duyệt."));
    }

    public static HrConnectEmail RegistrationReviewResult(
        string accountLabel,
        bool approved,
        string? reviewNote = null)
    {
        var safeLabel = E(accountLabel);
        if (approved)
        {
            return new HrConnectEmail(
                $"Hồ sơ {accountLabel} đã được phê duyệt",
                Render(
                    "Hồ sơ đã được phê duyệt",
                    $"<p style=\"margin:0 0 16px\">Hồ sơ <strong>{safeLabel}</strong> của bạn đã được phê duyệt.</p>" +
                    "<p style=\"margin:0\">Bạn có thể đăng nhập HR Connect và bắt đầu sử dụng các chức năng dành cho tài khoản của mình.</p>",
                    "Tài khoản của bạn đã sẵn sàng để sử dụng."));
        }

        var reason = string.IsNullOrWhiteSpace(reviewNote)
            ? string.Empty
            : $"<div style=\"margin:20px 0;padding:14px 16px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:6px\"><strong>Lý do:</strong> {E(reviewNote.Trim())}</div>";

        return new HrConnectEmail(
            $"Kết quả xét duyệt hồ sơ {accountLabel}",
            Render(
                "Cập nhật về hồ sơ đăng ký",
                $"<p style=\"margin:0 0 16px\">Hồ sơ <strong>{safeLabel}</strong> của bạn chưa được phê duyệt ở lần xét duyệt này.</p>" +
                reason +
                "<p style=\"margin:0\">Bạn có thể kiểm tra lại thông tin đã cung cấp hoặc liên hệ bộ phận hỗ trợ nếu cần được hướng dẫn.</p>",
                "HR Connect gửi bạn kết quả xét duyệt hồ sơ."));
    }

    public static HrConnectEmail SubmissionConsent(
        string candidateName,
        string jobTitle,
        string companyName,
        string confirmationUrl,
        DateTime expiresAtUtc,
        bool requiresLogin,
        bool isReminder)
    {
        var title = isReminder ? "Nhắc bạn xác nhận hồ sơ ứng tuyển" : "Bạn có một hồ sơ cần xác nhận";
        var instruction = requiresLogin
            ? "Đăng nhập đúng tài khoản Candidate để xem CV và đưa ra quyết định."
            : "Mở liên kết bảo mật bên dưới để xem CV và đưa ra quyết định.";
        // Vietnam stays on UTC+7 year-round, so this is safe in minimal containers
        // that do not ship the operating system time-zone database.
        var localExpiry = DateTime.SpecifyKind(expiresAtUtc, DateTimeKind.Utc).AddHours(7);

        return new HrConnectEmail(
            SubjectText($"{(isReminder ? "Nhắc lại: " : string.Empty)}Xác nhận hồ sơ ứng tuyển {jobTitle}"),
            Render(
                title,
                Greeting(candidateName) +
                $"<p style=\"margin:0 0 16px\">Một Affiliate Recruiter đã giới thiệu hồ sơ của bạn cho vị trí <strong>{E(jobTitle)}</strong> tại <strong>{E(companyName)}</strong>.</p>" +
                $"<p style=\"margin:0 0 22px\">{instruction} CV không được đính kèm trong email để bảo vệ thông tin cá nhân của bạn.</p>" +
                Button("Xem và xác nhận hồ sơ", confirmationUrl) +
                $"<p style=\"margin:20px 0 0;font-size:13px;color:#64748b\">Yêu cầu hết hạn lúc <strong>{localExpiry:HH:mm 'ngày' dd/MM/yyyy}</strong> (giờ Việt Nam). Nếu bạn không biết yêu cầu này, hãy chọn Từ chối.</p>",
                $"Xác nhận hồ sơ cho vị trí {jobTitle} trước khi hết hạn."));
    }

    private static string Render(string title, string content, string previewText)
    {
        return $"""
            <!doctype html>
            <html lang="vi">
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#f4f7f5;color:#1e293b;font-family:Arial,'Helvetica Neue',sans-serif">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0">{E(previewText)}</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;padding:28px 12px">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                    <tr><td style="padding:22px 28px;background:#244c35;color:#ffffff">
                      <div style="font-size:22px;font-weight:700;letter-spacing:.2px">HR Connect</div>
                      <div style="margin-top:4px;font-size:13px;color:#dce9df">Kết nối đúng người, đúng cơ hội</div>
                    </td></tr>
                    <tr><td style="padding:30px 28px;font-size:15px;line-height:1.65">
                      <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#183c29">{E(title)}</h1>
                      {content}
                    </td></tr>
                    <tr><td style="padding:18px 28px;background:#f8faf9;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#64748b">
                      Email này được gửi tự động bởi HR Connect. Vui lòng không trả lời email này.<br>
                      <span style="color:#94a3b8">hrconnectvn.online</span>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """;
    }

    private static string Greeting(string name) =>
        $"<p style=\"margin:0 0 16px\">Chào <strong>{E(string.IsNullOrWhiteSpace(name) ? "bạn" : name.Trim())}</strong>,</p>";

    private static string OtpBox(string otp) =>
        $"<div style=\"margin:22px 0;padding:18px;text-align:center;background:#f1f5f2;border:1px solid #dbe7de;border-radius:10px\"><span style=\"font-size:32px;font-weight:700;letter-spacing:8px;color:#183c29\">{E(otp)}</span></div>";

    private static string SecurityNote(string text) =>
        $"<div style=\"margin-top:22px;padding:14px 16px;background:#f8fafc;border-radius:8px;font-size:13px;color:#475569\">{E(text)}</div>";

    private static string Button(string label, string url) =>
        $"<div style=\"margin:24px 0\"><a href=\"{E(url)}\" style=\"display:inline-block;padding:12px 20px;background:#2f6a46;color:#ffffff;text-decoration:none;font-weight:700;border-radius:7px\">{E(label)}</a></div>";

    private static string E(string value) => WebUtility.HtmlEncode(value);

    private static string SubjectText(string value) =>
        value.Replace("\r", " ", StringComparison.Ordinal)
            .Replace("\n", " ", StringComparison.Ordinal)
            .Trim();
}
