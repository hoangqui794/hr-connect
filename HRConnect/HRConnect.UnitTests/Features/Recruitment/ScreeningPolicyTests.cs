using FluentAssertions;
using HRConnect.Application.Features.Recruitment.Common;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class ScreeningPolicyTests
{
    [Theory]
    [InlineData("CV_APPLICATION", ScreeningActor.ClientCompany)]
    [InlineData("HEADHUNT_COD", ScreeningActor.InternalHr)]
    [InlineData("CV_SOURCING", ScreeningActor.InternalHr)]
    [InlineData(" cv_sourcing ", ScreeningActor.InternalHr)]
    public void GetResponsibleActor_ShouldFollowServiceTypeMatrix(string serviceTypeCode, ScreeningActor expected)
    {
        ScreeningPolicy.GetResponsibleActor(serviceTypeCode).Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("UNKNOWN")]
    public void GetResponsibleActor_WhenServiceTypeIsUnknown_ShouldReturnNull(string? serviceTypeCode)
    {
        ScreeningPolicy.GetResponsibleActor(serviceTypeCode).Should().BeNull();
    }

    [Fact]
    public void CanScreen_ShouldRejectWrongActorForServiceType()
    {
        ScreeningPolicy.CanScreen(ScreeningActor.InternalHr, "CV_APPLICATION").Should().BeFalse();
        ScreeningPolicy.CanScreen(ScreeningActor.ClientCompany, "HEADHUNT_COD").Should().BeFalse();
        ScreeningPolicy.CanScreen(ScreeningActor.ClientCompany, "UNKNOWN").Should().BeFalse();
    }
}
