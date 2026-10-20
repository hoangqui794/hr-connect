using FluentAssertions;
using HRConnect.Application.Features.SubmissionConsents.RespondSubmissionConsent;
using Xunit;

namespace HRConnect.UnitTests.Features.SubmissionConsents;

/// <summary>BUG-04 (test 20/10): ứng viên phải từ chối được dù FE gửi kèm allowFutureReuse=false.</summary>
public class RespondSubmissionConsentValidatorTests
{
    private readonly RespondSubmissionConsentCommandValidator _validator = new();

    [Theory]
    [InlineData("DECLINE", null, true)]
    [InlineData("DECLINE", false, true)]
    [InlineData("DECLINE", true, false)]
    [InlineData("CONFIRM", true, true)]
    [InlineData("CONFIRM", false, true)]
    public void Decline_ShouldOnlyRejectWhenReuseIsTurnedOn(string decision, bool? allowFutureReuse, bool valid)
    {
        var result = _validator.Validate(new RespondSubmissionConsentCommand
        {
            Token = "token", Decision = decision, AllowFutureReuse = allowFutureReuse,
        });

        result.IsValid.Should().Be(valid);
    }
}
