using FluentAssertions;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;

namespace HRConnect.UnitTests.Features.Jobs;

/// <summary>
/// The job keeps when and why its status last changed, when it was sent for review and when the Client
/// reported paying its deposit, so the Client pages read real dates instead of parsing StatusReason text.
/// </summary>
public sealed class JobStatusTimestampsTests
{
    private static Job NewJob(string status) => new()
    {
        JobId = Guid.NewGuid(),
        Title = "Backend .NET",
        Status = status,
        CurrencyCode = "VND",
        Quantity = 1,
    };

    [Fact]
    public void ChangeStatus_records_when_and_why_the_status_changed()
    {
        var job = NewJob(JobStatuses.Active);
        var before = DateTime.UtcNow;

        JobTransitions.ChangeStatus(job, JobStatuses.Paused, Guid.NewGuid(), JobReasonCodes.PausedByClient, "Đủ ứng viên vòng 1");

        job.StatusReasonCode.Should().Be(JobReasonCodes.PausedByClient);
        job.StatusReason.Should().Be("Đủ ứng viên vòng 1");
        job.StatusChangedAt.Should().NotBeNull().And.BeOnOrAfter(before);
        job.SubmittedAt.Should().BeNull("only a submit for review sets SubmittedAt");
    }

    [Fact]
    public void Submitting_for_review_sets_SubmittedAt_and_resubmitting_moves_it()
    {
        var job = NewJob(JobStatuses.Draft);

        JobTransitions.ChangeStatus(job, JobStatuses.PendingReview, Guid.NewGuid(), JobReasonCodes.SubmittedForReview);
        var first = job.SubmittedAt;
        first.Should().NotBeNull();

        JobTransitions.ChangeStatus(job, JobStatuses.Rejected, Guid.NewGuid(), JobReasonCodes.RejectedOther, "Thiếu mô tả");
        job.SubmittedAt.Should().Be(first, "rejecting keeps the last submit time");

        JobTransitions.ChangeStatus(job, JobStatuses.PendingReview, Guid.NewGuid(), JobReasonCodes.SubmittedForReview);
        job.SubmittedAt.Should().BeOnOrAfter(first!.Value);
    }

    [Fact]
    public void HasSubmittedDeposit_reads_the_persisted_flag()
    {
        var waiting = NewJob(JobStatuses.PendingPayment);
        JobTransitions.HasSubmittedDeposit(waiting).Should().BeFalse();

        waiting.DepositSubmittedAt = DateTime.UtcNow;
        JobTransitions.HasSubmittedDeposit(waiting).Should().BeTrue();

        // Not lost when a later write replaces the free-text StatusReason.
        waiting.StatusReason = "Ghi chú khác";
        JobTransitions.HasSubmittedDeposit(waiting).Should().BeTrue();
    }

    [Fact]
    public void HasSubmittedDeposit_still_understands_rows_written_before_the_column()
    {
        var legacy = NewJob(JobStatuses.PendingPayment);
        legacy.StatusReason = "DEPOSIT_SUBMITTED";
        JobTransitions.HasSubmittedDeposit(legacy).Should().BeTrue();

        JobTransitions.HasSubmittedDeposit(NewJob(JobStatuses.Active)).Should().BeTrue("a live job has nothing left to pay");
    }

    [Fact]
    public void JobDto_exposes_the_status_dates_and_deposit_flag()
    {
        var job = NewJob(JobStatuses.PendingPayment);
        job.SubmittedAt = new DateTime(2026, 11, 1, 8, 0, 0, DateTimeKind.Utc);
        job.StatusChangedAt = new DateTime(2026, 11, 2, 8, 0, 0, DateTimeKind.Utc);
        job.StatusReasonCode = "DEPOSIT_SUBMITTED";
        job.DepositSubmittedAt = new DateTime(2026, 11, 3, 8, 0, 0, DateTimeKind.Utc);

        var dto = JobDto.From(job);

        dto.SubmittedAt.Should().Be(job.SubmittedAt);
        dto.StatusChangedAt.Should().Be(job.StatusChangedAt);
        dto.StatusReasonCode.Should().Be("DEPOSIT_SUBMITTED");
        dto.DepositSubmittedAt.Should().Be(job.DepositSubmittedAt);
        dto.HasSubmittedDeposit.Should().BeTrue();
    }
}
