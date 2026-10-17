using FluentAssertions;
using HRConnect.Application.Features.Candidates.Common;
using HRConnect.Domain.Constants;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class CandidateApplicationDisplayStatusMapperTests
{
    public static TheoryData<string, string> PersistedStatuses => new()
    {
        { ApplicationStates.Submitted, "SUBMITTED" },
        { ApplicationStates.Screening, "IN_REVIEW" },
        { ApplicationStates.Shortlisted, "SELECTED" },
        { ApplicationStates.Rejected, "NOT_SELECTED" },
        { ApplicationStates.Interview, "INTERVIEW" },
        { ApplicationStates.Backup, "IN_REVIEW" },
        { ApplicationStates.BackupNotSelected, "NOT_SELECTED" },
        { ApplicationStates.InterviewFailed, "NOT_SELECTED" },
        { ApplicationStates.OfferPending, "IN_REVIEW" },
        { ApplicationStates.OfferAccepted, "HIRED" },
        { ApplicationStates.OfferDeclined, "WITHDRAWN" },
        { ApplicationStates.NotStarted, "WITHDRAWN" },
        { ApplicationStates.Withdrawn, "WITHDRAWN" },
        { ApplicationStates.Placed, "HIRED" },
        { ApplicationStates.Closed, "NOT_SELECTED" }
    };

    [Theory]
    [MemberData(nameof(PersistedStatuses))]
    public void Map_CoversEveryPersistedApplicationStatus(string status, string expectedGroup)
    {
        CandidateApplicationDisplayStatusMapper.Map(status, logger: NullLogger.Instance)
            .Group.Should().Be(expectedGroup);
    }

    [Fact]
    public void Map_OfferPendingOnlyBecomesOfferAfterOfferWasSent()
    {
        CandidateApplicationDisplayStatusMapper.Map(ApplicationStates.OfferPending, [OfferStates.Draft])
            .Group.Should().Be("IN_REVIEW");
        CandidateApplicationDisplayStatusMapper.Map(ApplicationStates.OfferPending, [OfferStates.Sent])
            .Group.Should().Be("OFFER");
    }

    [Fact]
    public void GetInternalStatuses_SelectedOnlyIncludesShortlisted()
    {
        CandidateApplicationDisplayStatusMapper.GetInternalStatuses("SELECTED")
            .Should().BeEquivalentTo([ApplicationStates.Shortlisted]);

        CandidateApplicationDisplayStatusMapper.GetInternalStatuses("IN_REVIEW")
            .Should().NotContain(ApplicationStates.Shortlisted);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("FUTURE_INTERNAL_STATUS")]
    public void Map_UnknownStatusFailsClosed(string? status)
    {
        var result = CandidateApplicationDisplayStatusMapper.Map(status, logger: NullLogger.Instance);

        result.Group.Should().Be("IN_REVIEW");
        result.Label.Should().Be("Đang xem xét");
    }
}
