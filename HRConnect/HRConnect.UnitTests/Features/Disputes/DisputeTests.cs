using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Disputes;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Disputes;

/// <summary>SF-04 minimal scope (former docs/tasks/BE-tasks-03, acceptance items 1–6).</summary>
public class DisputeTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Guid _adminUserId = Guid.NewGuid();

    /// <summary>Values of the ck_notification_type check constraint.</summary>
    private static readonly string[] AllowedNotificationTypes =
        ["ACCOUNT", "COMPANY", "JOB", "SUBMISSION", "SUBMISSION_CONSENT_RESULT", "JOB_FIT", "APPLICATION_STATUS", "INTERVIEW", "OFFER", "AFFILIATE", "COMMISSION", "PAYOUT", "SYSTEM"];

    private DisputeHandlers Handlers() => new(
        new DisputeRepository(_context), new CandidateDuplicateRepository(_context),
        new BusinessSettingsService(new SystemSettingRepository(_context)),
        new TestUnitOfWork(_context), _audit.Object, new NotificationRepository(_context));

    private sealed class TestUnitOfWork(ApplicationDbContext context) : IUnitOfWork
    {
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
            context.SaveChangesAsync(cancellationToken);

        public Task BeginTransactionAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

        public async Task CommitTransactionAsync(CancellationToken cancellationToken = default) =>
            await context.SaveChangesAsync(cancellationToken);

        public Task RollbackTransactionAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed record Scenario(
        Job Job, Candidate Candidate, AffiliateProfile Winner, AffiliateProfile Blocked,
        Submission WinningSubmission, Submission BlockedSubmission, Attribution Attribution, Commission Commission);

    private AffiliateProfile SeedAffiliate(string name)
    {
        var now = DateTime.UtcNow;
        var user = new AppUser { UserId = Guid.NewGuid(), Email = $"{Guid.NewGuid():N}@example.com", PasswordHash = "x", Status = "ACTIVE", DisplayName = name, CreatedAt = now, UpdatedAt = now };
        var affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = user.UserId, User = user, DisplayName = name, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now };
        _context.AddRange(user, affiliate);
        return affiliate;
    }

    /// <summary>Affiliate A won the candidate; affiliate B's later submission was blocked as a duplicate.</summary>
    private Scenario Seed(DateTime? blockedAt = null, string commissionStatus = CommissionStates.InWarranty)
    {
        var now = DateTime.UtcNow;
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), ServiceTypeId = Guid.NewGuid(), CreatedBy = Guid.NewGuid(),
            Title = "Backend .NET", CurrencyCode = "VND", Quantity = 1, Status = "ACTIVE", CreatedAt = now, UpdatedAt = now,
            ConcurrencyToken = Guid.NewGuid(),
        };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(), FullName = "Nguyễn Văn A", NormalizedEmail = "a@example.com", NormalizedPhone = "0900000000",
            ProfileVisibility = "PRIVATE", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now,
        };
        var winner = SeedAffiliate("Affiliate A");
        var blocked = SeedAffiliate("Affiliate B");
        var winning = new Submission
        {
            SubmissionId = Guid.NewGuid(), CandidateId = candidate.CandidateId, CvId = Guid.NewGuid(), JobId = job.JobId,
            SubmittedBy = winner.UserId, Source = "AFFILIATE", Status = "ACCEPTED", SubmittedAt = now.AddDays(-3), UpdatedAt = now,
        };
        var blockedSubmission = new Submission
        {
            SubmissionId = Guid.NewGuid(), CandidateId = candidate.CandidateId, CvId = Guid.NewGuid(), JobId = job.JobId,
            SubmittedBy = blocked.UserId, Source = "AFFILIATE", Status = "BLOCKED_DUPLICATE", DuplicateOfSubmissionId = winning.SubmissionId,
            SubmittedAt = blockedAt ?? now.AddDays(-1), UpdatedAt = now,
        };
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = candidate.CandidateId, Status = ApplicationStates.Placed,
            AcceptedSubmissionId = winning.SubmissionId, AppliedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        var attribution = new Attribution
        {
            AttributionId = Guid.NewGuid(), ApplicationId = application.ApplicationId, AffiliateId = winner.AffiliateId,
            WinningSubmissionId = winning.SubmissionId, AttributionRule = "FIRST_ACCEPTED_SUBMISSION", Status = "ACTIVE",
            EstablishedAt = now.AddDays(-2), UpdatedAt = now,
        };
        var commission = new Commission
        {
            CommissionId = Guid.NewGuid(), AttributionId = attribution.AttributionId, PlacementId = Guid.NewGuid(), Amount = 1_000_000m,
            Status = commissionStatus, RuleSnapshot = "{}", CalculationSnapshot = "{}", CreatedAt = now, UpdatedAt = now,
        };
        _context.AddRange(job, candidate, winning, blockedSubmission, application, attribution, commission);
        _context.SaveChanges();
        return new Scenario(job, candidate, winner, blocked, winning, blockedSubmission, attribution, commission);
    }

    private Task<MyDisputeDto> RaiseAsync(Scenario s, string type = DisputeTypes.DuplicateSubmission) =>
        Handlers().Handle(new CreateDisputeCommand(s.Blocked.UserId, type, s.BlockedSubmission.SubmissionId, "Tôi liên hệ ứng viên trước.", "https://drive/proof"), default);

    private CandidateDuplicateCase SeedDuplicateCase(Scenario scenario)
    {
        var otherCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Nguyễn Văn A (hồ sơ cũ)",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var ordered = string.CompareOrdinal(
            scenario.Candidate.CandidateId.ToString("N"),
            otherCandidate.CandidateId.ToString("N")) <= 0
            ? (scenario.Candidate.CandidateId, otherCandidate.CandidateId)
            : (otherCandidate.CandidateId, scenario.Candidate.CandidateId);
        var duplicateCase = new CandidateDuplicateCase
        {
            DuplicateCaseId = Guid.NewGuid(),
            CandidateAId = ordered.Item1,
            CandidateBId = ordered.Item2,
            JobId = scenario.Job.JobId,
            RiskLevel = "HIGH",
            Status = "UNDER_REVIEW",
            IdempotencyKey = Guid.NewGuid().ToString("N"),
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _context.AddRange(otherCandidate, duplicateCase);
        _context.SaveChanges();
        return duplicateCase;
    }

    [Fact]
    public async Task BlockedAffiliate_CanRaiseOnce()
    {
        var s = Seed();

        var dispute = await RaiseAsync(s);
        var again = () => RaiseAsync(s);

        dispute.Status.Should().Be(DisputeStates.Open);
        (await again.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be(DisputeErrorCodes.AlreadyOpen);
    }

    [Fact]
    public async Task AfterWindow_ShouldBeRejected()
    {
        var s = Seed(blockedAt: DateTime.UtcNow.AddDays(-31));

        var act = () => RaiseAsync(s);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be(DisputeErrorCodes.WindowClosed);
    }

    [Fact]
    public async Task SomeoneElsesSubmission_ShouldNotBeEligible()
    {
        var s = Seed();

        var act = () => Handlers().Handle(new CreateDisputeCommand(
            s.Blocked.UserId, DisputeTypes.DuplicateSubmission, s.WinningSubmission.SubmissionId, "x", null), default);

        (await act.Should().ThrowAsync<BadRequestException>()).Which.ErrorCode.Should().Be(DisputeErrorCodes.NotEligible);
    }

    [Fact]
    public async Task Upheld_ShouldMoveAttributionAndUnpaidCommission()
    {
        var s = Seed();
        var dispute = await RaiseAsync(s);

        var result = await Handlers().Handle(Resolve(
            dispute.DisputeId, "UPHELD", "B có bằng chứng liên hệ trước."), default);

        result.Status.Should().Be(DisputeStates.Upheld);
        var attribution = _context.Attributions.Single(a => a.AttributionId == s.Attribution.AttributionId);
        attribution.AffiliateId.Should().Be(s.Blocked.AffiliateId);
        attribution.WinningSubmissionId.Should().Be(s.BlockedSubmission.SubmissionId);
        attribution.AttributionRule.Should().Be(AttributionRules.DisputeResolution);
        // The commission hangs off the attribution, so it now belongs to B.
        _context.Commissions.Single().AttributionId.Should().Be(attribution.AttributionId);
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == "ATTRIBUTION_TRANSFERRED"), It.IsAny<CancellationToken>()), Times.Once);
        _context.Notifications.Should().Contain(n => n.UserId == s.Winner.UserId && !n.Message.Contains("Affiliate B"));
        // BUG-07: every type must be allowed by ck_notification_type (InMemory does not enforce it).
        _context.Notifications.Should().OnlyContain(n => AllowedNotificationTypes.Contains(n.NotificationType));
    }

    [Fact]
    public async Task Upheld_WhenCommissionAlreadyPaid_ShouldBeRefused()
    {
        var s = Seed(commissionStatus: CommissionStates.Paid);
        var dispute = await RaiseAsync(s);

        var act = () => Handlers().Handle(Resolve(dispute.DisputeId, "UPHELD", "ok"), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be(DisputeErrorCodes.CommissionAlreadyPaid);
    }

    [Fact]
    public async Task Rejected_ShouldKeepAttribution()
    {
        var s = Seed();
        var dispute = await RaiseAsync(s);

        await Handlers().Handle(Resolve(dispute.DisputeId, "REJECTED", "Không đủ bằng chứng."), default);
        var again = () => Handlers().Handle(Resolve(dispute.DisputeId, "UPHELD", "x"), default);

        _context.Attributions.Single().AffiliateId.Should().Be(s.Winner.AffiliateId);
        (await again.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be(DisputeErrorCodes.NotOpen);
    }

    [Fact]
    public async Task ApprovingCommissionUnderDispute_ShouldBeBlocked()
    {
        var s = Seed(commissionStatus: CommissionStates.Earned);
        await RaiseAsync(s);
        var settlement = new SettlementCommandHandlers(new FinanceRepository(_context), new UnitOfWork(_context), _audit.Object);

        var act = () => settlement.Handle(new ApproveCommissionCommand(s.Commission.CommissionId, _adminUserId), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be(DisputeErrorCodes.CommissionUnderDispute);
    }

    [Fact]
    public async Task DuplicateCase_ShouldLinkDisputeAndHoldCommission()
    {
        var scenario = Seed(commissionStatus: CommissionStates.Earned);
        var duplicateCase = SeedDuplicateCase(scenario);

        var created = await RaiseAsync(scenario);
        var stored = _context.Disputes.Single(item => item.DisputeId == created.DisputeId);
        var settlement = new SettlementCommandHandlers(
            new FinanceRepository(_context), new TestUnitOfWork(_context), _audit.Object);
        var action = () => settlement.Handle(
            new ApproveCommissionCommand(scenario.Commission.CommissionId, _adminUserId), default);

        stored.CandidateDuplicateCaseId.Should().Be(duplicateCase.DuplicateCaseId);
        (await action.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be(DisputeErrorCodes.CommissionUnderDispute);
    }

    [Fact]
    public async Task DuplicateCaseWithoutDispute_ShouldHoldCommission()
    {
        var scenario = Seed(commissionStatus: CommissionStates.Earned);
        SeedDuplicateCase(scenario);
        var settlement = new SettlementCommandHandlers(
            new FinanceRepository(_context), new TestUnitOfWork(_context), _audit.Object);

        var action = () => settlement.Handle(
            new ApproveCommissionCommand(scenario.Commission.CommissionId, _adminUserId), default);

        (await action.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be(DisputeErrorCodes.CommissionUnderDispute);
    }

    [Fact]
    public async Task AffiliateView_ShouldNotExposeTheOtherAffiliate_ButAdminDetailShould()
    {
        var s = Seed();
        var dispute = await RaiseAsync(s);

        var mine = await Handlers().Handle(new GetMyDisputesQuery(s.Blocked.UserId, null), default);
        var detail = await Handlers().Handle(new GetAdminDisputeDetailQuery(dispute.DisputeId), default);

        System.Text.Json.JsonSerializer.Serialize(mine).Should().NotContain("Affiliate A").And.NotContain(s.Winner.UserId.ToString());
        detail.Submissions.Should().HaveCount(2);
        detail.CurrentAttribution!.AffiliateName.Should().Be("Affiliate A");
        detail.CandidateNormalizedEmail.Should().Be("a@example.com");
    }

    [Fact]
    public async Task Resolve_WithStaleToken_ShouldNotMutateDispute()
    {
        var s = Seed();
        var dispute = await RaiseAsync(s);

        var action = () => Handlers().Handle(new ResolveDisputeCommand(
            dispute.DisputeId,
            "REJECTED",
            "Không đủ bằng chứng.",
            _adminUserId,
            Guid.NewGuid(),
            Guid.NewGuid().ToString("N")), default);

        (await action.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be(DisputeErrorCodes.StaleResolution);
        _context.Disputes.Single().Status.Should().Be(DisputeStates.Open);
    }

    [Fact]
    public async Task Resolve_RetryWithSameIdempotencyKey_ReturnsOriginalOutcome()
    {
        var s = Seed();
        var dispute = await RaiseAsync(s);
        var command = Resolve(dispute.DisputeId, "REJECTED", "Không đủ bằng chứng.");

        var first = await Handlers().Handle(command, default);
        var retry = await Handlers().Handle(command, default);

        retry.Status.Should().Be(first.Status);
        retry.Resolution.Should().Be(first.Resolution);
        _context.Notifications.Count(notification => notification.RelatedEntityId == dispute.DisputeId)
            .Should().Be(1);
    }

    [Fact]
    public async Task Upheld_WhenAttributionIsMissing_ShouldFailExplicitly()
    {
        var s = Seed();
        var dispute = await RaiseAsync(s);
        s.Attribution.Status = "SUPERSEDED";
        _context.SaveChanges();

        var action = () => Handlers().Handle(
            Resolve(dispute.DisputeId, "UPHELD", "Đủ bằng chứng."), default);

        (await action.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be(DisputeErrorCodes.AttributionMissing);
        _context.Disputes.Single().Status.Should().Be(DisputeStates.Open);
    }

    [Fact]
    public async Task Create_WithInsecureEvidenceUrl_ShouldBeRejected()
    {
        var s = Seed();

        var action = () => Handlers().Handle(new CreateDisputeCommand(
            s.Blocked.UserId,
            DisputeTypes.DuplicateSubmission,
            s.BlockedSubmission.SubmissionId,
            "Có bằng chứng.",
            "http://example.com/proof"), default);

        await action.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*HTTPS*");
    }

    private ResolveDisputeCommand Resolve(Guid disputeId, string decision, string resolution)
    {
        var concurrencyToken = _context.Disputes.Single(item => item.DisputeId == disputeId).ConcurrencyToken;
        return new ResolveDisputeCommand(
            disputeId,
            decision,
            resolution,
            _adminUserId,
            concurrencyToken,
            Guid.NewGuid().ToString("N"));
    }
}
