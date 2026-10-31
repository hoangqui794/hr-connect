using FluentAssertions;
using HRConnect.Application.Common.Email;

namespace HRConnect.UnitTests.Common.Email;

public class RecruitmentCandidateEmailTemplateTests
{
    private static readonly RecruitmentCandidateEmailPayload Payload = new(
        CandidateName: "Nguyễn <An>",
        JobTitle: "Backend Developer",
        CompanyName: "Công ty <ABC>",
        PortalUrl: "https://www.hrconnectvn.online/register?role=CANDIDATE",
        InterviewRound: 2,
        ScheduledAt: new DateTime(2026, 10, 21, 2, 30, 0, DateTimeKind.Utc),
        DurationMinutes: 60,
        InterviewType: "ONLINE",
        MeetingLink: "https://meet.example.com/room");

    [Fact]
    public void InterviewScheduled_UsesVietnamTimeAndEncodesDynamicHtml()
    {
        var email = HrConnectEmailTemplates.InterviewScheduled(Payload);

        email.Subject.Should().Contain("Backend Developer");
        email.HtmlBody.Should().Contain(System.Net.WebUtility.HtmlEncode("09:30 ngày 21/10/2026"));
        email.HtmlBody.Should().Contain("Nguyễn &lt;An&gt;");
        email.HtmlBody.Should().NotContain("Nguyễn <An>");
    }

    [Fact]
    public void InterviewScheduled_ForLinkedAccount_UsesConfirmationCallToAction()
    {
        var email = HrConnectEmailTemplates.InterviewScheduled(Payload with
        {
            PortalUrl = "https://www.hrconnectvn.online/candidate/interviews/interview-1",
            HasLinkedAccount = true
        });

        email.HtmlBody.Should().Contain(System.Net.WebUtility.HtmlEncode("Xem lịch và xác nhận tham gia"));
        email.HtmlBody.Should().Contain("https://www.hrconnectvn.online/candidate/interviews/interview-1");
        email.HtmlBody.Should().NotContain("Đăng ký / đăng nhập HR Connect");
    }

    [Fact]
    public void InterviewUpdated_ExplainsThatDetailsChanged()
    {
        var email = HrConnectEmailTemplates.InterviewUpdated(Payload);

        email.Subject.Should().Contain("Backend Developer");
        email.HtmlBody.Should().Contain(System.Net.WebUtility.HtmlEncode("Thông tin phỏng vấn đã được cập nhật"));
        email.HtmlBody.Should().Contain(System.Net.WebUtility.HtmlEncode("09:30 ngày 21/10/2026"));
    }

    [Fact]
    public void OfferSent_DoesNotExposeSalaryOrDocumentContent()
    {
        var email = HrConnectEmailTemplates.OfferSent(Payload with { ExpiryDate = new DateOnly(2026, 10, 30) });

        email.HtmlBody.Should().Contain("không chứa chi tiết lương hoặc tài liệu Offer");
        email.HtmlBody.Should().NotContain("monthlyGrossSalary");
        email.HtmlBody.Should().Contain("30/10/2026");
    }

    [Fact]
    public void OfferWithdrawn_EncodesReason()
    {
        var email = HrConnectEmailTemplates.OfferWithdrawn(Payload with { Reason = "Nội dung <không tin cậy>" });

        email.HtmlBody.Should().Contain(System.Net.WebUtility.HtmlEncode("Nội dung <không tin cậy>"));
        email.HtmlBody.Should().NotContain("Nội dung <không tin cậy>");
    }

    [Fact]
    public void ApplicationNotStartedReported_DoesNotExposeInternalReason()
    {
        var email = HrConnectEmailTemplates.ApplicationNotStartedReported(Payload with
        {
            Reason = "Ghi chú nội bộ không được lộ"
        });

        email.Subject.Should().Contain("Backend Developer");
        email.HtmlBody.Should().Contain("HR Connect sẽ đối soát");
        email.HtmlBody.Should().NotContain("Ghi chú nội bộ không được lộ");
    }

    [Fact]
    public void InterviewScheduled_DoesNotMakeUnsafeMeetingSchemeClickable()
    {
        var email = HrConnectEmailTemplates.InterviewScheduled(Payload with
        {
            MeetingLink = "javascript:alert('unsafe')"
        });

        email.HtmlBody.Should().Contain("javascript:alert");
        email.HtmlBody.Should().NotContain("href=\"javascript:");
    }
}
