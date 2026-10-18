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
        { ApplicationStates.OfferPending, "OFFER" },
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
    public void Map_OfferPendingAlwaysStaysInOfferStage_AndUsesAccurateLabel()
    {
        var preparing = CandidateApplicationDisplayStatusMapper.Map(
            ApplicationStates.OfferPending,
            [OfferStates.Draft]);
        var sent = CandidateApplicationDisplayStatusMapper.Map(
            ApplicationStates.OfferPending,
            [OfferStates.Sent]);

        preparing.Group.Should().Be("OFFER");
        preparing.Label.Should().Be("Đang chuẩn bị offer");
        sent.Group.Should().Be("OFFER");
        sent.Label.Should().Be("Đã nhận lời mời");
    }

    [Fact]
    public void GetInternalStatuses_SelectedOnlyIncludesShortlisted()
    {
        CandidateApplicationDisplayStatusMapper.GetInternalStatuses("SELECTED")
            .Should().BeEquivalentTo([ApplicationStates.Shortlisted]);

        CandidateApplicationDisplayStatusMapper.GetInternalStatuses("IN_REVIEW")
            .Should().NotContain([ApplicationStates.Shortlisted, ApplicationStates.OfferPending]);

        CandidateApplicationDisplayStatusMapper.GetInternalStatuses("OFFER")
            .Should().BeEquivalentTo([ApplicationStates.OfferPending]);
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
