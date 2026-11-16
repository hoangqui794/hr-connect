using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Finance.Queries;
using HRConnect.Application.Features.Jobs.Commands.ApproveJob;
using HRConnect.Application.Features.Jobs.Commands.RecordJobPostingFeePayment;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Recruitment.Sourcing;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Finance;

/// <summary>
/// MF-05 CV_SOURCING money (docs/main-flows.md MF-05 and QUY-TAC-PHI section 2; former MF-05 task items 8–9):
/// deposit on approval, one commission per accepted CV, settlement by counted CVs.
/// </summary>
public class SourcingFinanceTests
{
    private const decimal PricePerCv = 600_000m;

    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<ICompanyUserRepository> _companyUsers = new();
    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();
    private readonly Guid _actor = Guid.NewGuid();

    public SourcingFinanceTests()
    {
        _companyUsers.Setup(r => r.GetByUserIdAsync(_clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyUserId = Guid.NewGuid(), CompanyId = _companyId, UserId = _clientUserId, Status = "ACTIVE" });
    }

    private FinanceRepository Repository => new(_context);
    private SourcingDeliveryRepository Deliveries => new(_context);
    private UnitOfWork UnitOfWork => new(_context);
    private BusinessSettingsService Settings => new(new SystemSettingRepository(_context));

    private SourcingFinanceService Finance(IAppNotifier? notifier = null) =>
        new(Repository, Deliveries, _audit.Object, Settings, NullLogger<SourcingFinanceService>.Instance, notifier);

    private DecideSourcingDeliveryCommandHandler Decide(IAppNotifier? notifier = null) =>
        new(Deliveries, _companyUsers.Object, UnitOfWork, _audit.Object, Finance(notifier), notifier);

    private SourcingAutoAcceptService AutoAccept() => new(Deliveries, UnitOfWork, _audit.Object, Finance());

    private SettlementCommandHandlers Settlement() =>
        new(Repository, UnitOfWork, _audit.Object, new NotificationRepository(_context), Finance(), Deliveries, new JobRepository(_context));

    private ApproveJobCommandHandler Approve() =>
        new(new JobRepository(_context), Settings, new NotificationRepository(_context), _audit.Object, UnitOfWork, Finance());

    // ---- setup ---------------------------------------------------------------------------

    private Job SeedJob(int target = 10, decimal? depositPercent = 50m, string status = "ACTIVE")
    {
        var now = DateTime.UtcNow;
        var type = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = "CV_SOURCING", Name = "CV Sourcing", IsActive = true, CreatedAt = now, UpdatedAt = now };
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = _companyId, ServiceTypeId = type.ServiceTypeId, ServiceType = type, CreatedBy = Guid.NewGuid(),
            Title = "Frontend ReactJS", CurrencyCode = "VND", Quantity = 1, Status = status,
            SourcingTarget = target, SourcingPricePerCv = PricePerCv, DepositPercent = depositPercent, ReviewDays = 7, PaymentDueDays = 20,
            AgreedAt = now, CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        _context.AddRange(type, job);
        _context.SaveChanges();
        return job;
    }

    /// <summary>A delivered CV whose candidate was referred by an affiliate (ACTIVE attribution).</summary>
    private SourcingDelivery SeedDelivery(Job job, bool attribution = true, DateTime? reviewDueAt = null)
    {
        var now = DateTime.UtcNow;
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(), FullName = "Nguyễn Văn A", ProfileVisibility = "PRIVATE", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now,
        };
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = candidate.CandidateId, Candidate = candidate,
            Status = ApplicationStates.Shortlisted, AppliedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        var delivery = new SourcingDelivery
        {
            DeliveryId = Guid.NewGuid(), JobId = job.JobId, ApplicationId = application.ApplicationId,
            Status = SourcingDeliveryStates.Delivered, DeliveredAt = now.AddMinutes(-1), DeliveredBy = _actor,
            ReviewDueAt = reviewDueAt ?? now.AddDays(7), CreatedAt = now, UpdatedAt = now,
        };
        _context.AddRange(candidate, application, delivery);
        if (attribution)
        {
            _context.Add(new Attribution
            {
                AttributionId = Guid.NewGuid(), ApplicationId = application.ApplicationId, AffiliateId = Guid.NewGuid(),
                WinningSubmissionId = Guid.NewGuid(), AttributionRule = "FIRST_ACCEPTED_SUBMISSION", Status = "ACTIVE",
                EstablishedAt = now, UpdatedAt = now,
            });
        }

        _context.SaveChanges();
        return delivery;
    }

    /// <summary>Marks deliveries as counted without going through a handler (no commission side effects).</summary>
    private void MarkCounted(IEnumerable<SourcingDelivery> deliveries)
    {
        foreach (var delivery in deliveries)
        {
            delivery.Status = SourcingDeliveryStates.Accepted;
        }

        _context.SaveChanges();
    }

    private Task<SourcingDeliveryDto> AcceptAsync(Job job, SourcingDelivery delivery) =>
        Decide().Handle(new DecideSourcingDeliveryCommand(
            job.JobId, delivery.DeliveryId, DecideSourcingDeliveryCommandHandler.DecisionAccepted, null, null, _clientUserId), default);

    private async Task<ServiceFee> CreateDepositAsync(Job job, bool paid = false)
    {
        var deposit = await Finance().EnsureDepositAsync(job, _actor);
        if (paid && deposit != null)
        {
            deposit.Status = ServiceFeeStates.Paid;
            deposit.PaidAt = DateTime.UtcNow;
        }
        await UnitOfWork.SaveChangesAsync();
        return deposit!;
    }

    private void PayAll()
    {
        foreach (var fee in _context.ServiceFees.Where(f => f.Status != ServiceFeeStates.Paid && f.Status != ServiceFeeStates.Cancelled))
        {
            fee.Status = ServiceFeeStates.Paid;
            fee.PaidAt = DateTime.UtcNow;
        }

        _context.SaveChanges();
    }

    // ---- deposit -------------------------------------------------------------------------

    [Fact]
    public async Task Deposit_TenCvsAt600kWithFiftyPercent_ShouldBeThreeMillion()
    {
        var job = SeedJob(target: 10);

        var deposit = await CreateDepositAsync(job);

        deposit.Kind.Should().Be(ServiceFeeKinds.Deposit);
        deposit.Amount.Should().Be(3_000_000m);
        deposit.BaseSalary.Should().Be(6_000_000m);
        deposit.FeeMultiplier.Should().Be(0.5m);
        deposit.Status.Should().Be(ServiceFeeStates.Pending);
        deposit.JobId.Should().Be(job.JobId);
        deposit.PlacementId.Should().BeNull();
        deposit.DueDate.Should().Be(DateOnly.FromDateTime(DateTime.UtcNow).AddDays(20));
    }

    [Fact]
    public async Task Deposit_CalledTwice_ShouldCreateOneFee()
    {
        var job = SeedJob();

        await CreateDepositAsync(job);
        await CreateDepositAsync(job);

        _context.ServiceFees.Count(f => f.JobId == job.JobId && f.Kind == ServiceFeeKinds.Deposit).Should().Be(1);
    }

    [Fact]
    public async Task Deposit_ZeroPercent_ShouldNotCreateFee()
    {
        var job = SeedJob(depositPercent: 0m);

        var deposit = await Finance().EnsureDepositAsync(job, _actor);

        deposit.Should().BeNull();
    }

    [Fact]
    public async Task AwaitingDeposit_ShouldListApprovedSourcingJobsWithoutDepositOnly()
    {
        var waiting = SeedJob();
        var billed = SeedJob();
        await CreateDepositAsync(billed);

        var ids = await Repository.GetSourcingJobIdsAwaitingDepositAsync(100);

        ids.Should().Contain(waiting.JobId).And.NotContain(billed.JobId);
    }

    // ---- per-CV commission ---------------------------------------------------------------

    [Fact]
    public async Task ClientAccepts_ShouldEarnCommissionOfPriceTimesSharePercent()
    {
        var job = SeedJob();
        var delivery = SeedDelivery(job);

        await AcceptAsync(job, delivery);

        var commission = _context.Commissions.Single();
        commission.SourcingDeliveryId.Should().Be(delivery.DeliveryId);
        commission.PlacementId.Should().BeNull();
        commission.CommissionRuleId.Should().BeNull();
        commission.Status.Should().Be(CommissionStates.Earned);
        commission.MilestoneType.Should().Be(CommissionMilestoneCodes.CvAccepted);
        // Admin default affiliate share is 60%: 600,000 × 60%.
        commission.Amount.Should().Be(360_000m);
    }

    [Fact]
    public async Task AutoAccept_ShouldAlsoEarnCommission()
    {
        var job = SeedJob();
        var delivery = SeedDelivery(job, reviewDueAt: DateTime.UtcNow.AddMinutes(-1).AddSeconds(30));

        var accepted = await AutoAccept().AutoAcceptAsync(delivery.DeliveryId, DateTime.UtcNow);

        accepted.Should().BeTrue();
        _context.Commissions.Single().SourcingDeliveryId.Should().Be(delivery.DeliveryId);
    }

    [Fact]
    public async Task CountedCvWithoutAttribution_ShouldNotCreateCommission()
    {
        var job = SeedJob();
        var delivery = SeedDelivery(job, attribution: false);

        await AcceptAsync(job, delivery);

        _context.Commissions.Should().BeEmpty();
    }

    [Fact]
    public async Task RejectedCv_ShouldNotEarnCommission()
    {
        var job = SeedJob();
        var delivery = SeedDelivery(job);

        await Decide().Handle(new DecideSourcingDeliveryCommand(
            job.JobId, delivery.DeliveryId, DecideSourcingDeliveryCommandHandler.DecisionRejected, "WRONG_JOB", null, _clientUserId), default);

        _context.Commissions.Should().BeEmpty();
    }

    // ---- settlement ----------------------------------------------------------------------

    [Fact]
    public async Task Settle_SevenCountedOfTen_ShouldBillBalanceAfterDeposit()
    {
        var job = SeedJob(target: 10, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted(Enumerable.Range(0, 7).Select(_ => SeedDelivery(job)).ToList());

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        // 7 × 600,000 = 4,200,000 − deposit 3,000,000.
        result.Kind.Should().Be(ServiceFeeKinds.Settlement);
        result.Amount.Should().Be(1_200_000m);
        result.Status.Should().Be(ServiceFeeStates.Pending);
    }

    [Fact]
    public async Task Settle_UnderDelivered_ShouldCreditTheUnusedDeposit()
    {
        var job = SeedJob(target: 10, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted(Enumerable.Range(0, 4).Select(_ => SeedDelivery(job)).ToList());

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        // 4 × 600,000 = 2,400,000 < deposit 3,000,000: 600,000 goes back to the Client.
        result.Kind.Should().Be(ServiceFeeKinds.Credit);
        result.Amount.Should().Be(600_000m);
    }

    [Fact]
    public async Task Settle_DepositCoversExactly_ShouldRecordPaidZeroSettlement()
    {
        var job = SeedJob(target: 10, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted(Enumerable.Range(0, 5).Select(_ => SeedDelivery(job)).ToList());

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        result.Kind.Should().Be(ServiceFeeKinds.Settlement);
        result.Amount.Should().Be(0m);
        result.Status.Should().Be(ServiceFeeStates.Paid);
    }

    [Fact]
    public async Task Settle_CalledTwice_ShouldReturnTheSameFee()
    {
        var job = SeedJob(target: 10, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted([SeedDelivery(job)]);

        var first = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);
        var second = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        second.ServiceFeeId.Should().Be(first.ServiceFeeId);
        _context.ServiceFees.Count(f => f.JobId == job.JobId && ServiceFeeKinds.Closing.Contains(f.Kind)).Should().Be(1);
    }

    [Fact]
    public async Task ReachingTarget_ShouldSettleAutomatically()
    {
        var job = SeedJob(target: 2);
        await CreateDepositAsync(job, paid: true);
        var first = SeedDelivery(job);
        var second = SeedDelivery(job);

        await AcceptAsync(job, first);
        _context.ServiceFees.Any(f => f.Kind == ServiceFeeKinds.Settlement).Should().BeFalse();

        await AcceptAsync(job, second);

        // 2 × 600,000 = 1,200,000 − deposit 600,000.
        var settlement = _context.ServiceFees.Single(f => f.JobId == job.JobId && f.Kind == ServiceFeeKinds.Settlement);
        settlement.Amount.Should().Be(600_000m);
        _context.Commissions.Count().Should().Be(2);
    }

    [Fact]
    public async Task Settle_UnpaidDepositWithZeroCountedCvs_ShouldCancelDepositAndNotCreateCredit()
    {
        var job = SeedJob(target: 10, status: "CLOSED");
        var deposit = await CreateDepositAsync(job, paid: false);

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        result.Kind.Should().Be(ServiceFeeKinds.Settlement);
        result.Amount.Should().Be(0m);
        result.Status.Should().Be(ServiceFeeStates.Paid);

        _context.ServiceFees.Any(f => f.JobId == job.JobId && f.Kind == ServiceFeeKinds.Credit).Should().BeFalse();
        var updatedDeposit = _context.ServiceFees.Single(f => f.ServiceFeeId == deposit.ServiceFeeId);
        updatedDeposit.Status.Should().Be(ServiceFeeStates.Cancelled);

        _audit.Verify(a => a.AddAsync(
            It.Is<HRConnect.Application.Common.Models.AuditEntry>(e =>
                e.Action == SourcingFinanceService.SourcingDepositCancelledAction
                && e.EntityType == "SERVICE_FEE"
                && e.EntityId == deposit.ServiceFeeId),
            It.IsAny<CancellationToken>()), Times.Once);

        // Once settled, the background worker will no longer pick this closed job up again.
        var awaiting = await Repository.GetClosedSourcingJobIdsAwaitingSettlementAsync(100);
        awaiting.Should().NotContain(job.JobId);
    }

    [Fact]
    public async Task Settle_UnpaidDepositWithCountedCvs_ShouldCancelDepositAndBillFullCountedTotalWithoutDeductingDeposit()
    {
        var job = SeedJob(target: 10, status: "CLOSED");
        var deposit = await CreateDepositAsync(job, paid: false);
        deposit.Status = ServiceFeeStates.Overdue;
        var delivery1 = SeedDelivery(job);
        var delivery2 = SeedDelivery(job);
        var delivery3 = SeedDelivery(job);
        await AcceptAsync(job, delivery1);
        await AcceptAsync(job, delivery2);
        await AcceptAsync(job, delivery3);

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        // 3 × 600,000 = 1,800,000; unpaid deposit (3,000,000) is cancelled and NOT deducted.
        result.Kind.Should().Be(ServiceFeeKinds.Settlement);
        result.Amount.Should().Be(1_800_000m);
        result.Status.Should().Be(ServiceFeeStates.Pending);

        _context.ServiceFees.Any(f => f.JobId == job.JobId && f.Kind == ServiceFeeKinds.Credit).Should().BeFalse();
        var updatedDeposit = _context.ServiceFees.Single(f => f.ServiceFeeId == deposit.ServiceFeeId);
        updatedDeposit.Status.Should().Be(ServiceFeeStates.Cancelled);

        _audit.Verify(a => a.AddAsync(
            It.Is<HRConnect.Application.Common.Models.AuditEntry>(e =>
                e.Action == SourcingFinanceService.SourcingDepositCancelledAction
                && e.EntityType == "SERVICE_FEE"
                && e.EntityId == deposit.ServiceFeeId),
            It.IsAny<CancellationToken>()), Times.Once);

        // Once Client pays the full SETTLEMENT, the cancelled deposit does not block commission approval.
        PayAll();
        var commission = _context.Commissions.First(c => c.SourcingDeliveryId == delivery1.DeliveryId);
        var approveResult = await Settlement().Handle(new ApproveCommissionCommand(commission.CommissionId, _actor), default);
        approveResult.Status.Should().Be(CommissionStates.Payable);
    }

    [Fact]
    public async Task Settle_NotSourcingJob_ShouldBeRejected()
    {
        var job = SeedJob();
        job.ServiceType!.Code = "HEADHUNT_COD";
        _context.SaveChanges();

        var act = () => Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("JOB_NOT_SOURCING");
    }

    [Theory]
    [InlineData(JobStatuses.Active)]
    [InlineData(JobStatuses.Paused)]
    public async Task Settle_NonClosedJobBelowTarget_ShouldBeRejectedWith409(string status)
    {
        var job = SeedJob(target: 10, status: status);
        await CreateDepositAsync(job, paid: true);
        MarkCounted(Enumerable.Range(0, 4).Select(_ => SeedDelivery(job)).ToList());

        var act = () => Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be("SOURCING_NOT_CLOSED_OR_TARGET_NOT_REACHED");
        _context.ServiceFees.Any(f => f.JobId == job.JobId && ServiceFeeKinds.Closing.Contains(f.Kind)).Should().BeFalse();
    }

    [Fact]
    public async Task Settle_ActiveJobAtTargetWithoutPendingDeliveries_ShouldSucceed()
    {
        var job = SeedJob(target: 2, status: JobStatuses.Active);
        await CreateDepositAsync(job, paid: true);
        var d1 = SeedDelivery(job);
        var d2 = SeedDelivery(job);
        d1.Status = SourcingDeliveryStates.Accepted;
        d2.Status = SourcingDeliveryStates.AutoAccepted;
        await _context.SaveChangesAsync();

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        // 2 × 600,000 = 1,200,000 − deposit 600,000.
        result.Kind.Should().Be(ServiceFeeKinds.Settlement);
        result.Amount.Should().Be(600_000m);
        result.Status.Should().Be(ServiceFeeStates.Pending);
    }

    [Fact]
    public async Task Settle_ClosedJobWithDeliveredCvPendingClient_ShouldBeRejectedWith409()
    {
        var job = SeedJob(target: 10, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted([SeedDelivery(job)]);
        SeedDelivery(job); // still DELIVERED

        var act = () => Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be("SOURCING_DELIVERIES_PENDING_CLIENT_REVIEW");
        _context.ServiceFees.Any(f => f.JobId == job.JobId && ServiceFeeKinds.Closing.Contains(f.Kind)).Should().BeFalse();
    }

    [Fact]
    public async Task Settle_ClosedJobWithOtherRejectionPendingHrReview_ShouldBeRejectedWith409()
    {
        var job = SeedJob(target: 10, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted([SeedDelivery(job)]);
        var rejectedOther = SeedDelivery(job);
        rejectedOther.Status = SourcingDeliveryStates.Rejected;
        rejectedOther.RejectReasonCode = SourcingRejectReasons.Other;
        rejectedOther.RejectNote = "Cần HR kiểm tra thêm";
        await _context.SaveChangesAsync();

        var act = () => Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be("SOURCING_REJECTIONS_PENDING_HR_REVIEW");
        _context.ServiceFees.Any(f => f.JobId == job.JobId && ServiceFeeKinds.Closing.Contains(f.Kind)).Should().BeFalse();
    }

    [Fact]
    public async Task Settle_ClosedJobAfterHrUpheldOtherAndStandardRejections_ShouldSucceed()
    {
        var job = SeedJob(target: 10, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted([SeedDelivery(job)]);

        var wrongJobRejected = SeedDelivery(job);
        wrongJobRejected.Status = SourcingDeliveryStates.Rejected;
        wrongJobRejected.RejectReasonCode = SourcingRejectReasons.WrongJob;

        var upheldOther = SeedDelivery(job);
        upheldOther.Status = SourcingDeliveryStates.Rejected;
        upheldOther.RejectReasonCode = SourcingRejectReasons.Other;
        upheldOther.RejectNote = "Không đạt tiêu chí chuyên môn";

        var replaced = SeedDelivery(job);
        replaced.Status = SourcingDeliveryStates.Replaced;

        _context.AuditLogs.Add(new AuditLog
        {
            Action = SourcingDeliveryAudit.RejectionReviewed,
            EntityType = SourcingDeliveryAudit.EntityType,
            EntityId = upheldOther.DeliveryId,
            ActorType = AuditActorTypes.User,
            ActorUserId = _actor,
            Source = AuditSources.Application,
            NewValues = "{\"status\":\"REJECTED\",\"upheld\":true,\"note\":\"Đã xác minh\"}",
            CreatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        // 1 × 600,000 = 600,000 < deposit 3,000,000 => CREDIT 2,400,000.
        result.Kind.Should().Be(ServiceFeeKinds.Credit);
        result.Amount.Should().Be(2_400_000m);
    }

    [Fact]
    public async Task Settle_ManualGateDoesNotAffectWorkerSettleAsyncOrTargetAutoSettle()
    {
        var job = SeedJob(target: 2, status: JobStatuses.Closed);
        await CreateDepositAsync(job, paid: true);
        MarkCounted([SeedDelivery(job)]);
        SeedDelivery(job); // still DELIVERED

        var manualAct = () => Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);
        (await manualAct.Should().ThrowAsync<ConflictException>()).Which.ErrorCode
            .Should().Be("SOURCING_DELIVERIES_PENDING_CLIENT_REVIEW");

        var workerFee = await Finance().SettleAsync(job, null);
        await UnitOfWork.SaveChangesAsync();
        workerFee.Kind.Should().Be(ServiceFeeKinds.Settlement);
        workerFee.Amount.Should().Be(0m);
        workerFee.Status.Should().Be(ServiceFeeStates.Paid);
    }

    // ---- payout gate ---------------------------------------------------------------------

    [Fact]
    public async Task ApproveSourcingCommission_BeforeSettlement_ShouldBeRejected()
    {
        var job = SeedJob(target: 10);
        await CreateDepositAsync(job);
        var delivery = SeedDelivery(job, reviewDueAt: DateTime.UtcNow.AddSeconds(1));
        await AcceptAsync(job, delivery);
        PayAll();

        var act = () => Settlement().Handle(new ApproveCommissionCommand(_context.Commissions.Single().CommissionId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("SOURCING_NOT_SETTLED");
    }

    [Fact]
    public async Task ApproveSourcingCommission_SettlementUnpaid_ShouldBeRejected()
    {
        var job = SeedJob(target: 1);
        await CreateDepositAsync(job);
        PayAll();
        var delivery = SeedDelivery(job);
        await AcceptAsync(job, delivery);

        var act = () => Settlement().Handle(new ApproveCommissionCommand(_context.Commissions.Single().CommissionId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("SERVICE_FEE_NOT_PAID");
    }

    [Fact]
    public async Task ApproveSourcingCommission_WithPendingDeliveryInsideReviewWindow_ShouldBeRejected()
    {
        var job = SeedJob(target: 2);
        await CreateDepositAsync(job);
        var accepted = SeedDelivery(job, reviewDueAt: DateTime.UtcNow.AddDays(3));
        await AcceptAsync(job, accepted);
        SeedDelivery(job, reviewDueAt: DateTime.UtcNow.AddDays(3)); // still DELIVERED
        job.Status = JobStatuses.Closed;
        await Finance().SettleAsync(job, _actor);
        await UnitOfWork.SaveChangesAsync();
        PayAll();

        var act = () => Settlement().Handle(new ApproveCommissionCommand(_context.Commissions.Single().CommissionId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("SOURCING_DISPUTE_WINDOW_OPEN");
    }

    [Fact]
    public async Task ApproveSourcingCommission_AcceptedAndPaidBeforeReviewDue_ShouldBecomePayable()
    {
        var job = SeedJob(target: 1);
        await CreateDepositAsync(job);
        var delivery = SeedDelivery(job, reviewDueAt: DateTime.UtcNow.AddDays(3));
        await AcceptAsync(job, delivery);
        PayAll();

        var result = await Settlement().Handle(new ApproveCommissionCommand(_context.Commissions.Single().CommissionId, _actor), default);

        result.Status.Should().Be(CommissionStates.Payable);
    }

    // ---- deposit gates the job (decision 2026-10-17) -------------------------------------

    private Job SeedPendingReviewJob(decimal? proposedPrice = PricePerCv)
    {
        if (!_context.Companies.Any(c => c.CompanyId == _companyId))
        {
            _context.Add(new Company { CompanyId = _companyId, CompanyName = "HR Connect Demo Company", TaxCode = "0123456789", VerificationStatus = "VERIFIED" });
        }

        var job = SeedJob(target: 10, depositPercent: null, status: "PENDING_REVIEW");
        job.AgreedAt = null;
        job.SourcingPricePerCv = null;
        job.ProposedPricePerCv = proposedPrice;
        job.CreatedBy = _clientUserId;
        _context.SaveChanges();
        return job;
    }

    [Fact]
    public async Task ApproveSourcingJob_WithDeposit_ShouldWaitForPaymentAndCreateDeposit()
    {
        var job = SeedPendingReviewJob();

        await Approve().Handle(new ApproveJobCommand { JobId = job.JobId, UserId = _actor, ConcurrencyToken = job.ConcurrencyToken }, default);

        job.Status.Should().Be("PENDING_PAYMENT");
        var deposit = _context.ServiceFees.Single(f => f.JobId == job.JobId);
        deposit.Kind.Should().Be(ServiceFeeKinds.Deposit);
        // Admin defaults: 50% of 10 × 600,000.
        deposit.Amount.Should().Be(3_000_000m);
    }

    [Fact]
    public async Task RecordingTheDeposit_ShouldOpenTheJob()
    {
        var job = SeedPendingReviewJob();
        await Approve().Handle(new ApproveJobCommand { JobId = job.JobId, UserId = _actor, ConcurrencyToken = job.ConcurrencyToken }, default);
        var deposit = _context.ServiceFees.Single(f => f.JobId == job.JobId);

        await Settlement().Handle(new RecordServiceFeePaymentCommand(deposit.ServiceFeeId, DateTime.UtcNow, "UNC-TEST-1", _actor), default);

        job.Status.Should().Be("ACTIVE");
        job.PostedAt.Should().NotBeNull();
        _context.Notifications.Should().Contain(n => n.RelatedEntityId == job.JobId && n.Title == "Tin tuyển dụng đã được công bố");
    }

    [Fact]
    public async Task PostingFeePayment_OnSourcingJob_ShouldBeRejected()
    {
        var job = SeedPendingReviewJob();
        await Approve().Handle(new ApproveJobCommand { JobId = job.JobId, UserId = _actor, ConcurrencyToken = job.ConcurrencyToken }, default);
        var handler = new RecordJobPostingFeePaymentCommandHandler(new JobRepository(_context), new NotificationRepository(_context), UnitOfWork);

        var act = () => handler.Handle(new RecordJobPostingFeePaymentCommand { JobId = job.JobId, UserId = _actor, IsBackofficeOrSystem = true, PaymentReference = "X" }, default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("JOB_REQUIRES_SOURCING_DEPOSIT");
        job.Status.Should().Be("PENDING_PAYMENT");
    }

    // ---- queries -------------------------------------------------------------------------

    [Fact]
    public async Task GetServiceFees_FilteredByJob_ShouldReturnSourcingFeesWithKindAndJobTitle()
    {
        _context.Add(new Company { CompanyId = _companyId, CompanyName = "HR Connect Demo Company", TaxCode = "0123456789", VerificationStatus = "VERIFIED" });
        var job = SeedJob();
        await CreateDepositAsync(job);
        var handler = new FinanceQueryHandlers(Repository, _companyUsers.Object);

        var result = await handler.Handle(new GetServiceFeesQuery(null, null, 1, 20, job.JobId), default);

        var fee = result.Items.Single();
        fee.Kind.Should().Be(ServiceFeeKinds.Deposit);
        fee.JobId.Should().Be(job.JobId);
        fee.JobTitle.Should().Be("Frontend ReactJS");
        fee.PlacementId.Should().BeNull();
    }

    [Fact]
    public async Task GetCommissions_SourcingAfterDepositAndSettlementPaid_ShouldReturnPaidServiceFeeStatus()
    {
        var job = SeedJob(target: 1);
        var deposit = await CreateDepositAsync(job);
        deposit.Status = ServiceFeeStates.Paid;
        var delivery = SeedDelivery(job);
        await AcceptAsync(job, delivery);
        SeedAffiliateForJob();

        var settlement = _context.ServiceFees.Single(f => f.JobId == job.JobId && f.Kind == ServiceFeeKinds.Settlement);
        settlement.Status = ServiceFeeStates.Paid;
        await _context.SaveChangesAsync();

        var handler = new FinanceQueryHandlers(Repository, _companyUsers.Object);
        var result = await handler.Handle(new GetCommissionsQuery(null, null, 1, 20), default);

        result.Items.Single().ServiceFeeStatus.Should().Be(ServiceFeeStates.Paid);
    }

    [Fact]
    public async Task GetCommissions_SourcingWithPendingOrOverdueFee_ShouldReflectPendingOrOverdue()
    {
        var pendingJob = SeedJob(target: 1);
        var pendingDeposit = await CreateDepositAsync(pendingJob);
        pendingDeposit.Status = ServiceFeeStates.Paid;
        await AcceptAsync(pendingJob, SeedDelivery(pendingJob));

        var overdueJob = SeedJob(target: 2);
        var overdueDeposit = await CreateDepositAsync(overdueJob);
        overdueDeposit.Status = ServiceFeeStates.Overdue;
        await AcceptAsync(overdueJob, SeedDelivery(overdueJob));
        SeedAffiliateForJob();
        await _context.SaveChangesAsync();

        var handler = new FinanceQueryHandlers(Repository, _companyUsers.Object);
        var result = await handler.Handle(new GetCommissionsQuery(null, null, 1, 20), default);

        result.Items.Single(c => c.JobId == pendingJob.JobId).ServiceFeeStatus.Should().Be(ServiceFeeStates.Pending);
        result.Items.Single(c => c.JobId == overdueJob.JobId).ServiceFeeStatus.Should().Be(ServiceFeeStates.Overdue);
    }

    [Fact]
    public async Task EnsureDepositAndSettle_WithUsdJob_ShouldPropagateUsdCurrencyAndCommissionNotification()
    {
        var job = SeedJob(target: 2, depositPercent: 50m);
        job.SourcingPricePerCv = 100m;
        job.CurrencyCode = "USD";
        await _context.SaveChangesAsync();

        var deposit = await Finance().EnsureDepositAsync(job, _actor);
        deposit.Should().NotBeNull();
        deposit!.CurrencyCode.Should().Be("USD");
        deposit.Status = ServiceFeeStates.Paid;

        var delivery = SeedDelivery(job);
        await AcceptAsync(job, delivery);
        SeedAffiliateForJob();
        await _context.SaveChangesAsync();

        var settlement = _context.ServiceFees.SingleOrDefault(f => f.JobId == job.JobId && f.Kind == ServiceFeeKinds.Settlement);
        if (settlement == null)
        {
            settlement = await Finance().SettleAsync(job, _actor);
        }
        settlement.CurrencyCode.Should().Be("USD");
        settlement.Status = ServiceFeeStates.Paid;

        var commission = _context.Commissions.Single(c => c.SourcingDeliveryId == delivery.DeliveryId);
        commission.Status = CommissionStates.Earned;
        await _context.SaveChangesAsync();

        await Settlement().Handle(new ApproveCommissionCommand(commission.CommissionId, _actor), default);
        var notification = _context.Notifications.OrderByDescending(n => n.CreatedAt).First(n => n.RelatedEntityId == commission.CommissionId);
        notification.Message.Should().Contain("USD");
        notification.Message.Should().NotContain(" đ ");
    }

    [Fact]
    public async Task OnDeliveryCountedAndSettle_NotifyAffiliateWhenEarned_AndNotifyClientForSettlementAndCredit()
    {
        var jobSettlement = SeedJob(target: 2, depositPercent: 25m);
        await CreateDepositAsync(jobSettlement, paid: true); // 300,000 paid deposit vs 600,000 per CV
        var d1 = SeedDelivery(jobSettlement);
        SeedAffiliateForJob();
        await _context.SaveChangesAsync();
        var affiliateUserId = _context.AffiliateProfiles.Local.Single().UserId;

        var notifierAccept = new Mock<IAppNotifier>();
        await Decide(notifierAccept.Object).Handle(new DecideSourcingDeliveryCommand(
            jobSettlement.JobId, d1.DeliveryId, DecideSourcingDeliveryCommandHandler.DecisionAccepted, null, null, _clientUserId), default);

        var earnedCommission = _context.Commissions.Single(c => c.SourcingDeliveryId == d1.DeliveryId);
        notifierAccept.Verify(n => n.NotifyUsersAsync(
            It.Is<IEnumerable<Guid>>(ids => ids.Single() == affiliateUserId),
            It.Is<AppNotice>(x =>
                x.NotificationType == "COMMISSION" &&
                x.RelatedEntityType == "COMMISSION" &&
                x.RelatedEntityId == earnedCommission.CommissionId &&
                x.RouteHint == "/affiliate/commissions"),
            It.IsAny<CancellationToken>()), Times.Once);

        var notifierSettle = new Mock<IAppNotifier>();
        var settlementFee = await Finance(notifierSettle.Object).SettleAsync(jobSettlement, _actor);
        settlementFee.Kind.Should().Be(ServiceFeeKinds.Settlement);
        notifierSettle.Verify(n => n.NotifyCompanyAsync(
            _companyId,
            It.Is<AppNotice>(x =>
                x.NotificationType == "SERVICE_FEE" &&
                x.RelatedEntityType == "SERVICE_FEE" &&
                x.RelatedEntityId == settlementFee.ServiceFeeId &&
                x.Title == "Phí quyết toán CV Sourcing cần thanh toán" &&
                x.RouteHint == "/client/billing"),
            It.IsAny<CancellationToken>()), Times.Once);

        var jobCredit = SeedJob(target: 4, depositPercent: 50m);
        await CreateDepositAsync(jobCredit, paid: true); // 1,200,000 paid deposit
        var d2 = SeedDelivery(jobCredit);
        d2.Status = SourcingDeliveryStates.Accepted;
        await _context.SaveChangesAsync();

        var notifierCredit = new Mock<IAppNotifier>();
        var creditFee = await Finance(notifierCredit.Object).SettleAsync(jobCredit, _actor);
        creditFee.Kind.Should().Be(ServiceFeeKinds.Credit);
        notifierCredit.Verify(n => n.NotifyCompanyAsync(
            _companyId,
            It.Is<AppNotice>(x =>
                x.NotificationType == "SERVICE_FEE" &&
                x.RelatedEntityType == "SERVICE_FEE" &&
                x.RelatedEntityId == creditFee.ServiceFeeId &&
                x.Title == "Có khoản hoàn tiền quyết toán CV Sourcing" &&
                x.RouteHint == "/client/billing"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private void SeedAffiliateForJob()
    {
        var now = DateTime.UtcNow;
        foreach (var attr in _context.Attributions.Local)
        {
            if (!_context.AffiliateProfiles.Local.Any(a => a.AffiliateId == attr.AffiliateId))
            {
                var userId = Guid.NewGuid();
                _context.Add(new AppUser { UserId = userId, Email = $"{userId:N}@test.local", PasswordHash = "x", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now });
                _context.Add(new AffiliateProfile
                {
                    AffiliateId = attr.AffiliateId,
                    UserId = userId,
                    DisplayName = "Demo Affiliate",
                    AffiliateType = "STANDARD",
                    Status = "ACTIVE",
                    CreatedAt = now,
                    UpdatedAt = now,
                });
            }
        }
    }
}
