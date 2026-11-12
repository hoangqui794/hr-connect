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

    public static HrConnectEmail CandidateIdentityClaimOtp(
        string recipientName,
        string otp,
        int expirationMinutes)
    {
        return new HrConnectEmail(
            "Xác minh email liên kết hồ sơ HR Connect",
            Render(
                "Xác minh email cũ của bạn",
                Greeting(recipientName) +
                "<p style=\"margin:0 0 16px\">Một tài khoản Candidate đang yêu cầu xác minh địa chỉ email này để liên kết lại hồ sơ, CV và lịch sử ứng tuyển trước đây.</p>" +
                OtpBox(otp) +
                $"<p style=\"margin:0 0 16px\">Mã có hiệu lực trong <strong>{expirationMinutes} phút</strong> và chỉ dùng được cho yêu cầu này.</p>" +
                SecurityNote("Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email. Hồ sơ sẽ không được liên kết nếu chưa xác minh đúng mã."),
                $"Mã xác minh email có hiệu lực trong {expirationMinutes} phút."));
    }

    public static HrConnectEmail SplitAccountOtp(
        string email,
        string otp,
        int expirationMinutes)
    {
        return new HrConnectEmail(
            "Mã xác thực tách tài khoản HR Connect",
            Render(
                "Xác thực để tách tài khoản",
                "<p style=\"margin:0 0 16px\">Chào bạn,</p>" +
                $"<p style=\"margin:0 0 16px\">HR Connect nhận được yêu cầu tách địa chỉ email <strong>{E(email)}</strong> thành một tài khoản Ứng viên độc lập mới.</p>" +
                "<p style=\"margin:0 0 16px\">Vui lòng nhập mã OTP dưới đây để hoàn tất việc xác thực và kích hoạt tài khoản của bạn:</p>" +
                OtpBox(otp) +
                $"<p style=\"margin:0 0 16px\">Mã có hiệu lực trong <strong>{expirationMinutes} phút</strong>. Sau khi hoàn tất, email này sẽ được giải phóng khỏi tài khoản cũ và trở thành tài khoản chính độc lập.</p>" +
                SecurityNote("Tuyệt đối không chia sẻ mã này với bất kỳ ai để đảm bảo an toàn cho tài khoản. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email."),
                $"Mã xác thực tách tài khoản: {otp}. Có hiệu lực trong {expirationMinutes} phút."));
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
            : $"<div style=\"margin:20px 0;padding:16px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;color:#78350f\"><strong style=\"display:block;margin-bottom:4px;color:#92400e\">Lý do</strong>{E(reviewNote.Trim())}</div>";

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
                $"<p style=\"margin:0 0 16px\">Một Cộng tác viên (Affiliate) đã giới thiệu hồ sơ của bạn cho vị trí <strong>{E(jobTitle)}</strong> tại <strong>{E(companyName)}</strong>.</p>" +
                $"<p style=\"margin:0 0 22px\">{instruction} CV không được đính kèm trong email để bảo vệ thông tin cá nhân của bạn.</p>" +
                Button("Xem và xác nhận hồ sơ", confirmationUrl) +
                $"<p style=\"margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b\">Yêu cầu hết hạn lúc <strong style=\"color:#334155\">{localExpiry:HH:mm 'ngày' dd/MM/yyyy}</strong> (giờ Việt Nam). Nếu bạn không biết yêu cầu này, hãy chọn Từ chối.</p>",
                $"Xác nhận hồ sơ cho vị trí {jobTitle} trước khi hết hạn."));
    }

    public static HrConnectEmail InterviewScheduled(RecruitmentCandidateEmailPayload payload) =>
        InterviewNotice(
            payload,
            "Bạn có lịch phỏng vấn mới",
            "Lịch phỏng vấn mới",
            "Xem lịch và xác nhận tham gia");

    public static HrConnectEmail InterviewUpdated(RecruitmentCandidateEmailPayload payload) =>
        InterviewNotice(
            payload,
            "Thông tin phỏng vấn đã được cập nhật",
            "Thông tin phỏng vấn đã thay đổi",
            "Xem thông tin phỏng vấn");

    public static HrConnectEmail InterviewRescheduled(RecruitmentCandidateEmailPayload payload) =>
        InterviewNotice(
            payload,
            "Lịch phỏng vấn đã được dời",
            "Lịch phỏng vấn đã thay đổi",
            "Xem lịch phỏng vấn mới");

    public static HrConnectEmail InterviewCancelled(RecruitmentCandidateEmailPayload payload)
    {
        var organization = CompanyOrPlatform(payload.CompanyName);
        var reason = string.IsNullOrWhiteSpace(payload.Reason)
            ? string.Empty
            : $"<p style=\"margin:0 0 16px\">Lý do: {E(payload.Reason.Trim())}</p>";
        var accountInstruction = payload.HasLinkedAccount
            ? "Đăng nhập HR Connect để xem hồ sơ và các cập nhật tiếp theo."
            : "Bạn có thể đăng ký hoặc đăng nhập để theo dõi các cập nhật tiếp theo cho hồ sơ của mình.";
        var actionLabel = payload.HasLinkedAccount ? "Xem hồ sơ ứng tuyển" : "Đăng ký / đăng nhập HR Connect";
        return new HrConnectEmail(
            SubjectText($"Lịch phỏng vấn vị trí {payload.JobTitle} đã bị hủy"),
            Render(
                "Lịch phỏng vấn đã bị hủy",
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">{organization} đã hủy lịch phỏng vấn Vòng {payload.InterviewRound ?? 1} cho vị trí <strong>{E(payload.JobTitle)}</strong>.</p>" +
                reason +
                $"<p style=\"margin:0 0 18px\">{accountInstruction}</p>" +
                Button(actionLabel, payload.PortalUrl),
                $"Cập nhật lịch phỏng vấn cho vị trí {payload.JobTitle}."));
    }

    public static HrConnectEmail OfferSent(RecruitmentCandidateEmailPayload payload)
    {
        var company = CompanyOrPlatform(payload.CompanyName);
        var accountInstruction = payload.HasLinkedAccount
            ? "Đăng nhập HR Connect để xem nội dung Offer và phản hồi."
            : "Đăng ký hoặc đăng nhập HR Connect để xem nội dung Offer và phản hồi.";
        var actionLabel = payload.HasLinkedAccount
            ? "Xem và phản hồi Offer"
            : "Đăng ký / đăng nhập để xem Offer";
        var expiry = payload.ExpiryDate is { } value
            ? $" Vui lòng phản hồi trước ngày <strong>{value:dd/MM/yyyy}</strong>."
            : string.Empty;
        return new HrConnectEmail(
            SubjectText($"Chúc mừng! Bạn nhận được thư mời nhận việc cho vị trí {payload.JobTitle}"),
            Render(
                "Chúc mừng bạn nhận được thư mời nhận việc!",
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">Chúc mừng bạn! {company} đã gửi thư mời nhận việc cho vị trí <strong>{E(payload.JobTitle)}</strong>.{expiry}</p>" +
                $"<p style=\"margin:0 0 18px\">{accountInstruction} Vì an toàn thông tin, email này không chứa chi tiết lương hoặc tài liệu Offer.</p>" +
                Button(actionLabel, payload.PortalUrl),
                $"Chúc mừng bạn đã nhận được thư mời nhận việc cho vị trí {payload.JobTitle}!"));
    }

    public static HrConnectEmail OfferWithdrawn(RecruitmentCandidateEmailPayload payload)
    {
        var accountInstruction = payload.HasLinkedAccount
            ? "Đăng nhập HR Connect để theo dõi trạng thái hồ sơ."
            : "Đăng ký hoặc đăng nhập HR Connect để theo dõi trạng thái hồ sơ.";
        var actionLabel = payload.HasLinkedAccount
            ? "Xem trạng thái hồ sơ"
            : "Đăng ký / đăng nhập HR Connect";
        var reason = string.IsNullOrWhiteSpace(payload.Reason)
            ? string.Empty
            : $"<p style=\"margin:0 0 16px\">Lý do: {E(payload.Reason.Trim())}</p>";
        return new HrConnectEmail(
            SubjectText($"Offer cho vị trí {payload.JobTitle} đã được thu hồi"),
            Render(
                "Offer đã được thu hồi",
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">Lời mời nhận việc cho vị trí <strong>{E(payload.JobTitle)}</strong> đã được thu hồi.</p>" +
                reason +
                $"<p style=\"margin:0 0 18px\">{accountInstruction}</p>" +
                Button(actionLabel, payload.PortalUrl),
                $"Cập nhật Offer cho vị trí {payload.JobTitle}."));
    }

    public static HrConnectEmail OfferExpired(RecruitmentCandidateEmailPayload payload)
    {
        var accountInstruction = payload.HasLinkedAccount
            ? "Đăng nhập HR Connect để xem lại trạng thái hồ sơ của bạn."
            : "Đăng ký hoặc đăng nhập HR Connect để xem lại trạng thái hồ sơ của bạn.";
        var actionLabel = payload.HasLinkedAccount
            ? "Xem trạng thái hồ sơ"
            : "Đăng ký / đăng nhập HR Connect";
        return new HrConnectEmail(
            SubjectText($"Offer cho vị trí {payload.JobTitle} đã hết hạn phản hồi"),
            Render(
                "Offer đã hết hạn phản hồi",
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">Lời mời nhận việc cho vị trí <strong>{E(payload.JobTitle)}</strong> đã hết hạn phản hồi.</p>" +
                $"<p style=\"margin:0 0 18px\">{accountInstruction}</p>" +
                Button(actionLabel, payload.PortalUrl),
                $"Offer cho vị trí {payload.JobTitle} đã hết hạn phản hồi."));
    }

    public static HrConnectEmail ApplicationNotStartedReported(RecruitmentCandidateEmailPayload payload)
    {
        var organization = CompanyOrPlatform(payload.CompanyName);
        return new HrConnectEmail(
            SubjectText($"Cập nhật kết quả nhận việc cho vị trí {payload.JobTitle}"),
            Render(
                "Cập nhật kết quả nhận việc",
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">{organization} đã cập nhật rằng bạn chưa bắt đầu làm việc cho vị trí <strong>{E(payload.JobTitle)}</strong>.</p>" +
                "<p style=\"margin:0 0 18px\">HR Connect sẽ đối soát kết quả này. Nếu thông tin chưa chính xác, vui lòng liên hệ bộ phận hỗ trợ; email này không cho phép tự thay đổi trạng thái hồ sơ.</p>" +
                Button("Đăng ký / đăng nhập để xem hồ sơ", payload.PortalUrl),
                $"Cập nhật hồ sơ ứng tuyển vị trí {payload.JobTitle}."));
    }

    public static HrConnectEmail ApplicationStartedConfirmed(RecruitmentCandidateEmailPayload payload)
    {
        var organization = CompanyOrPlatform(payload.CompanyName);
        return new HrConnectEmail(
            SubjectText($"Xác nhận bắt đầu làm việc cho vị trí {payload.JobTitle}"),
            Render(
                "Đã xác nhận bắt đầu làm việc",
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">{organization} đã xác nhận bạn bắt đầu làm việc cho vị trí <strong>{E(payload.JobTitle)}</strong>.</p>" +
                "<p style=\"margin:0 0 18px\">Chúc bạn có một hành trình mới thật nhiều thành công. Bạn có thể mở HR Connect để xem trạng thái hồ sơ.</p>" +
                Button("Xem hồ sơ ứng tuyển", payload.PortalUrl),
                $"Bạn đã được xác nhận bắt đầu làm việc cho vị trí {payload.JobTitle}."));
    }

    public static HrConnectEmail PlannedStartDateChanged(RecruitmentCandidateEmailPayload payload)
    {
        var oldDate = payload.OldPlannedStartDate?.ToString("dd/MM/yyyy") ?? "chưa xác định";
        var newDate = payload.NewPlannedStartDate?.ToString("dd/MM/yyyy") ?? "chưa xác định";
        var reason = string.IsNullOrWhiteSpace(payload.Reason)
            ? string.Empty
            : $"<p style=\"margin:0 0 16px\"><strong>Lý do:</strong> {E(payload.Reason.Trim())}</p>";
        return new HrConnectEmail(
            SubjectText($"Ngày nhận việc cho vị trí {payload.JobTitle} đã thay đổi"),
            Render(
                "Ngày nhận việc đã thay đổi",
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">Doanh nghiệp đã cập nhật ngày nhận việc cho vị trí <strong>{E(payload.JobTitle)}</strong> từ <strong>{oldDate}</strong> sang <strong>{newDate}</strong>.</p>" +
                reason +
                "<p style=\"margin:0 0 18px\">Nếu thông tin chưa đúng với thỏa thuận, vui lòng liên hệ trực tiếp doanh nghiệp.</p>" +
                Button("Xem hồ sơ ứng tuyển", payload.PortalUrl),
                $"Ngày nhận việc mới: {newDate}."));
    }

    private static HrConnectEmail InterviewNotice(
        RecruitmentCandidateEmailPayload payload,
        string heading,
        string preview,
        string linkedAccountActionLabel)
    {
        var scheduledAt = payload.ScheduledAt is { } value
            ? ToVietnamTime(value).ToString("HH:mm 'ngày' dd/MM/yyyy")
            : "sẽ được cập nhật trên HR Connect";
        var organization = CompanyOrPlatform(payload.CompanyName);
        var format = string.IsNullOrWhiteSpace(payload.InterviewType) ? string.Empty :
            $"<li><strong>Hình thức:</strong> {E(payload.InterviewType.Trim())}</li>";
        var location = string.IsNullOrWhiteSpace(payload.Location) ? string.Empty :
            $"<li><strong>Địa điểm:</strong> {E(payload.Location.Trim())}</li>";
        var meeting = string.IsNullOrWhiteSpace(payload.MeetingLink) ? string.Empty :
            $"<li><strong>Liên kết tham gia:</strong> {SafeMeetingLink(payload.MeetingLink)}</li>";
        var duration = payload.DurationMinutes is { } minutes && minutes > 0
            ? $"<li><strong>Thời lượng dự kiến:</strong> {minutes} phút</li>"
            : string.Empty;

        var instruction = payload.HasLinkedAccount
            ? "Đăng nhập HR Connect để xem lịch và phản hồi cho doanh nghiệp."
            : "Đăng ký hoặc đăng nhập HR Connect để theo dõi hồ sơ và các cập nhật tiếp theo.";
        var actionLabel = payload.HasLinkedAccount
            ? linkedAccountActionLabel
            : "Đăng ký / đăng nhập HR Connect";

        return new HrConnectEmail(
            SubjectText($"{preview}: {payload.JobTitle}"),
            Render(
                heading,
                Greeting(payload.CandidateName) +
                $"<p style=\"margin:0 0 16px\">{organization} đã cập nhật lịch phỏng vấn Vòng {payload.InterviewRound ?? 1} cho vị trí <strong>{E(payload.JobTitle)}</strong>.</p>" +
                $"<ul style=\"margin:0 0 18px;padding-left:20px\"><li><strong>Thời gian:</strong> {E(scheduledAt)} (giờ Việt Nam)</li>{duration}{format}{location}{meeting}</ul>" +
                $"<p style=\"margin:0 0 18px\">{instruction}</p>" +
                Button(actionLabel, payload.PortalUrl),
                $"{preview} cho vị trí {payload.JobTitle}."));
    }

    private static string CompanyOrPlatform(string? companyName) =>
        string.IsNullOrWhiteSpace(companyName)
            ? "HR Connect"
            : $"<strong>{E(companyName.Trim())}</strong>";

    private static DateTime ToVietnamTime(DateTime value) =>
        (value.Kind == DateTimeKind.Utc ? value : value.ToUniversalTime()).AddHours(7);

    private static string SafeMeetingLink(string rawUrl)
    {
        var trimmed = rawUrl.Trim();
        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            return $"<a href=\"{E(uri.AbsoluteUri)}\">Mở cuộc họp</a>";
        }

        // The API retains the original value for the authenticated Candidate view, but an email
        // must never turn an untrusted scheme such as javascript: into a clickable link.
        return E(trimmed);
    }

    private static string Render(string title, string content, string previewText)
    {
        return $$"""
            <!doctype html>
            <html lang="vi">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <meta name="color-scheme" content="light">
              <meta name="supported-color-schemes" content="light">
              <title>{{E(title)}} | HR Connect</title>
              <style>
                @media only screen and (max-width:620px) {
                  .email-shell { padding:16px 8px !important; }
                  .email-card { border-radius:14px !important; }
                  .email-header { padding:20px !important; }
                  .email-content { padding:26px 20px !important; }
                  .email-footer { padding:18px 20px !important; }
                  .email-title { font-size:24px !important; }
                  .email-button { display:block !important; text-align:center !important; }
                }
              </style>
            </head>
            <body style="margin:0;padding:0;background:#eff6ff;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,sans-serif;-webkit-text-size-adjust:100%;text-size-adjust:100%">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">{{E(previewText)}}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:100%;background:#eff6ff;padding:32px 12px">
                <tr>
                  <td align="center">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #dbeafe;border-radius:18px;overflow:hidden;box-shadow:0 14px 35px rgba(15,23,42,.08)">
                      <tr>
                        <td class="email-header" style="padding:24px 30px;background:#0c4a6e;border-bottom:4px solid #38bdf8">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="52" valign="middle">
                                <table role="presentation" width="44" height="44" cellspacing="0" cellpadding="0" border="0" style="width:44px;height:44px;background:#ffffff;border-radius:12px">
                                  <tr><td align="center" valign="middle" style="font-size:23px;line-height:44px;font-weight:800;color:#0c4a6e">H</td></tr>
                                </table>
                              </td>
                              <td valign="middle">
                                <div style="font-size:21px;line-height:1.2;font-weight:800;letter-spacing:-.3px;color:#ffffff">HR Connect</div>
                                <div style="margin-top:4px;font-size:12px;line-height:1.4;color:#bae6fd">Kết nối đúng người, đúng cơ hội</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td class="email-content" style="padding:36px 34px 34px;font-size:15px;line-height:1.7;color:#334155">
                          <h1 class="email-title" style="margin:0 0 20px;font-size:28px;line-height:1.3;letter-spacing:-.5px;color:#0f172a">{{E(title)}}</h1>
                          {{content}}
                        </td>
                      </tr>
                      <tr>
                        <td class="email-footer" style="padding:20px 34px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.65;color:#64748b">
                          <strong style="color:#334155">HR Connect</strong> · Email thông báo tự động, vui lòng không trả lời.<br>
                          <a href="https://www.hrconnectvn.online" style="color:#2563eb;text-decoration:none">www.hrconnectvn.online</a>
                        </td>
                      </tr>
                    </table>
                    <div style="padding:18px 12px 0;font-size:11px;line-height:1.5;color:#64748b">Nền tảng tuyển dụng và kết nối cơ hội nghề nghiệp.</div>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }

    private static string Greeting(string name) =>
        $"<p style=\"margin:0 0 16px\">Chào <strong>{E(string.IsNullOrWhiteSpace(name) ? "bạn" : name.Trim())}</strong>,</p>";

    private static string OtpBox(string otp) =>
        $"<div style=\"margin:24px 0;padding:20px 16px;text-align:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px\"><div style=\"margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#1d4ed8\">Mã xác thực</div><span style=\"font-size:34px;line-height:1.2;font-weight:800;letter-spacing:8px;color:#0c4a6e\">{E(otp)}</span></div>";

    private static string SecurityNote(string text) =>
        $"<div style=\"margin-top:22px;padding:15px 17px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;line-height:1.6;color:#475569\"><strong style=\"display:block;margin-bottom:3px;color:#334155\">Lưu ý bảo mật</strong>{E(text)}</div>";

    private static string Button(string label, string url) =>
        $"<div style=\"margin:26px 0\"><a class=\"email-button\" href=\"{E(url)}\" style=\"display:inline-block;padding:13px 22px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;line-height:1.3;font-weight:700;border-radius:9px;box-shadow:0 5px 12px rgba(37,99,235,.22)\">{E(label)} &nbsp;&rarr;</a></div>";

    private static string E(string value) => WebUtility.HtmlEncode(value);

    private static string SubjectText(string value) =>
        value.Replace("\r", " ", StringComparison.Ordinal)
            .Replace("\n", " ", StringComparison.Ordinal)
            .Trim();
}
