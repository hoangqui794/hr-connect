using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Email;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Email;

namespace HRConnect.UnitTests.Services.Email;

public class AccountLifecycleEmailOutboxWorkerTests
{
    [Fact]
    public void CreateEmail_WhenRecruitmentTemplate_UsesRecruitmentPayload()
    {
        var payload = new RecruitmentCandidateEmailPayload(
            "Nguyễn An",
            "QA Engineer",
            "HR Connect",
            "https://hrconnectvn.online/register?role=CANDIDATE",
            InterviewRound: 1,
            ScheduledAt: new DateTime(2026, 10, 21, 2, 0, 0, DateTimeKind.Utc));
        var outbox = new EmailOutbox
        {
            TemplateCode = RecruitmentCandidateEmailTemplates.InterviewScheduled,
            Payload = JsonSerializer.Serialize(payload)
        };

        var email = AccountLifecycleEmailOutboxWorker.CreateEmail(outbox);

        email.Subject.Should().Contain("QA Engineer");
        email.HtmlBody.Should().Contain("Nguyễn An");
    }

    [Fact]
    public void SupportedTemplates_ContainsEveryCandidateRecruitmentTemplate()
    {
        AccountLifecycleEmailOutboxWorker.SupportedTemplates
            .Should().BeSupersetOf(RecruitmentCandidateEmailTemplates.All);
    }
}
