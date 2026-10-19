using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;

namespace HRConnect.UnitTests.Features.Recruitment;

public class CandidateRecruitmentDeliveryPolicyTests
{
    [Fact]
    public void Resolve_WhenCandidateHasLinkedAccount_PrefersInAppNotification()
    {
        var userId = Guid.NewGuid();

        var result = CandidateRecruitmentDeliveryPolicy.Resolve(new Candidate
        {
            UserId = userId,
            Email = "candidate@example.com"
        });

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.InApp);
        result.UserId.Should().Be(userId);
        result.RecipientEmail.Should().BeNull();
    }

    [Fact]
    public void Resolve_WhenCandidateHasNoAccountAndValidEmail_QueuesEmail()
    {
        var result = CandidateRecruitmentDeliveryPolicy.Resolve(new Candidate
        {
            Email = "  candidate@example.com  "
        });

        result.Channel.Should().Be(CandidateRecruitmentDeliveryChannel.Email);
        result.RecipientEmail.Should().Be("candidate@example.com");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("Candidate <candidate@example.com>")]
    public void RequireReachable_WhenNoAccountAndEmailIsNotValid_ThrowsDomainError(string? email)
    {
        var act = () => CandidateRecruitmentDeliveryPolicy.RequireReachable(new Candidate { Email = email });

        var exception = act.Should().Throw<BadRequestException>().Which;
        exception.ErrorCode.Should().Be(CandidateRecruitmentDeliveryPolicy.DeliveryUnavailableErrorCode);
    }
}
