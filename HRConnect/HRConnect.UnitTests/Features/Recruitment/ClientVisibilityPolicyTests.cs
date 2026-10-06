using FluentAssertions;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;

namespace HRConnect.UnitTests.Features.Recruitment;

public sealed class ClientVisibilityPolicyTests
{
    [Theory]
    [InlineData("CV_APPLICATION", "SUBMITTED", true)]
    [InlineData("HEADHUNT_COD", "SUBMITTED", false)]
    [InlineData("CV_SOURCING", "SCREENING", false)]
    [InlineData("CV_SOURCING", "REJECTED", false)]
    [InlineData("HEADHUNT_COD", "BACKUP", false)]
    [InlineData("HEADHUNT_COD", "SHORTLISTED", true)]
    [InlineData("HEADHUNT_COD", "INTERVIEW", true)]
    [InlineData("CV_SOURCING", "PLACED", true)]
    public void IsVisibleToClient_WithoutHistory_ShouldFollowStatus(string serviceType, string status, bool expected)
    {
        ClientVisibilityPolicy.IsVisibleToClient(serviceType, status, []).Should().Be(expected);
    }

    [Theory]
    [InlineData("BACKUP")]
    [InlineData("WITHDRAWN")]
    [InlineData("BACKUP_NOT_SELECTED")]
    public void IsVisibleToClient_WhenEverShortlisted_ShouldStayVisible(string status)
    {
        ClientVisibilityPolicy.IsVisibleToClient("HEADHUNT_COD", status, ["SCREENING", "SHORTLISTED", "INTERVIEW"])
            .Should().BeTrue();
    }

    [Fact]
    public void IsVisibleToClientExpression_ShouldMatchInMemoryRule()
    {
        var predicate = ClientVisibilityPolicy.IsVisibleToClientExpression.Compile();

        predicate(App("HEADHUNT_COD", ApplicationStates.Submitted)).Should().BeFalse();
        predicate(App("CV_APPLICATION", ApplicationStates.Submitted)).Should().BeTrue();
        predicate(App("CV_SOURCING", ApplicationStates.Backup, ApplicationStates.Shortlisted)).Should().BeTrue();
        predicate(App("CV_SOURCING", ApplicationStates.Backup)).Should().BeFalse();
    }

    [Theory]
    [InlineData("HEADHUNT_COD", ContactOwner.InternalHr)]
    [InlineData("CV_SOURCING", ContactOwner.ClientCompany)]
    [InlineData("CV_APPLICATION", ContactOwner.ClientCompany)]
    public void GetContactOwner_ShouldFollowMainFlows(string serviceType, ContactOwner expected)
    {
        ClientVisibilityPolicy.GetContactOwner(serviceType).Should().Be(expected);
    }

    [Theory]
    [InlineData("HEADHUNT_COD", "SHORTLISTED", false, true)]
    [InlineData("HEADHUNT_COD", "OFFER_ACCEPTED", false, true)]
    [InlineData("HEADHUNT_COD", "PLACED", false, false)]
    [InlineData("HEADHUNT_COD", "CLOSED", true, false)]
    [InlineData("CV_SOURCING", "SHORTLISTED", false, false)]
    [InlineData("CV_APPLICATION", "SUBMITTED", false, false)]
    public void ShouldMaskContactForClient_ShouldHideHeadhuntUntilPlaced(
        string serviceType, string status, bool hasPlacement, bool expected)
    {
        ClientVisibilityPolicy.ShouldMaskContactForClient(serviceType, status, hasPlacement).Should().Be(expected);
    }

    private static HRConnect.Domain.Entities.Application App(string serviceType, string status, params string[] history) => new()
    {
        Status = status,
        Job = new Job { ServiceType = new ServiceType { Code = serviceType } },
        ApplicationStatusHistories = history.Select(h => new ApplicationStatusHistory { NewStatus = h }).ToList()
    };
}
