using HRConnect.Application.Common.Email;

namespace HRConnect.UnitTests.Common.Email;

public class HrConnectEmailTemplatesTests
{
    [Fact]
    public void RegistrationOtp_EncodesDynamicContent_AndUsesBrandLayout()
    {
        var email = HrConnectEmailTemplates.RegistrationOtp(
            "An <script>alert(1)</script>", "123456", 15, "Ứng viên", false);

        Assert.Equal("Mã xác thực tài khoản HR Connect", email.Subject);
        Assert.DoesNotContain("123456", email.Subject);
        Assert.Contains("123456", email.HtmlBody);
        Assert.Contains("HR Connect", email.HtmlBody);
        Assert.Contains("An &lt;script&gt;alert(1)&lt;/script&gt;", email.HtmlBody);
        Assert.DoesNotContain("<script>alert(1)</script>", email.HtmlBody);
        Assert.Contains("hrconnectvn.online", email.HtmlBody);
    }

    [Fact]
    public void ReviewResult_EncodesAdminReviewNote()
    {
        var email = HrConnectEmailTemplates.RegistrationReviewResult(
            "Đối tác tuyển dụng", approved: false, "Thiếu <b>giấy phép</b>");

        Assert.Contains("Thiếu &lt;b&gt;giấy ph&#233;p&lt;/b&gt;", email.HtmlBody);
        Assert.DoesNotContain("Thiếu <b>giấy phép</b>", email.HtmlBody);
    }

    [Fact]
    public void SubmissionConsent_EncodesJobCompanyAndUrl()
    {
        var email = HrConnectEmailTemplates.SubmissionConsent(
            "Candidate", "Senior <Developer>", "A&B", "https://example.test/?x=1&y=2",
            new DateTime(2026, 10, 3, 10, 0, 0, DateTimeKind.Utc), false, false);

        Assert.Contains("Senior &lt;Developer&gt;", email.HtmlBody);
        Assert.Contains("A&amp;B", email.HtmlBody);
        Assert.Contains("https://example.test/?x=1&amp;y=2", email.HtmlBody);
        Assert.Contains("giờ Việt Nam", email.HtmlBody);
    }
}
