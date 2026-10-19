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

    // MF-03 C3: a CV_SOURCING CV is paid per delivery, so the Client sees it only once it was delivered,
    // whatever its status (a shortlisted or BACKUP CV that was never delivered stays hidden).
    [Theory]
    [InlineData("SHORTLISTED", new[] { "SCREENING" }, false, false)]
    [InlineData("BACKUP", new[] { "SCREENING", "SHORTLISTED" }, false, false)]
    [InlineData("PLACED", new string[0], false, false)]
    [InlineData("SHORTLISTED", new[] { "SCREENING" }, true, true)]
    [InlineData("INTERVIEW", new[] { "SHORTLISTED" }, true, true)]
    public void IsVisibleToClient_CvSourcing_ShouldRequireDelivery(
        string status, string[] history, bool delivered, bool expected)
    {
        ClientVisibilityPolicy.IsVisibleToClient("CV_SOURCING", status, history, delivered).Should().Be(expected);
    }

    [Fact]
    public void IsVisibleToClientExpression_ShouldMatchInMemoryRule()
    {
        var predicate = ClientVisibilityPolicy.IsVisibleToClientExpression.Compile();

        predicate(App("HEADHUNT_COD", ApplicationStates.Submitted)).Should().BeFalse();
        predicate(App("HEADHUNT_COD", ApplicationStates.Backup, ApplicationStates.Shortlisted)).Should().BeTrue();
        predicate(App("CV_APPLICATION", ApplicationStates.Submitted)).Should().BeTrue();
        predicate(App("CV_SOURCING", ApplicationStates.Backup, ApplicationStates.Shortlisted)).Should().BeFalse();
        predicate(App("CV_SOURCING", ApplicationStates.Shortlisted)).Should().BeFalse();
        predicate(Delivered(App("CV_SOURCING", ApplicationStates.Shortlisted))).Should().BeTrue();
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

    private static HRConnect.Domain.Entities.Application Delivered(HRConnect.Domain.Entities.Application app)
    {
        app.SourcingDeliveries.Add(new SourcingDelivery { Status = SourcingDeliveryStates.Delivered });
        return app;
    }
}
