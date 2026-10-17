using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Finance.Queries;
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
/// MF-05 CV_SOURCING money (docs/MF05/mf05-viec-can-lam-theo-quy-tac-phi.md, E8 and E9 items 8–9):
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

    private SourcingFinanceService Finance() =>
        new(Repository, Deliveries, _audit.Object, Settings, NullLogger<SourcingFinanceService>.Instance);

    private DecideSourcingDeliveryCommandHandler Decide() =>
        new(Deliveries, _companyUsers.Object, UnitOfWork, _audit.Object, Finance());

    private SourcingAutoAcceptService AutoAccept() => new(Deliveries, UnitOfWork, _audit.Object, Finance());

    private SettlementCommandHandlers Settlement() =>
        new(Repository, UnitOfWork, _audit.Object, sourcingFinance: Finance(), deliveries: Deliveries);

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

    private async Task<ServiceFee> CreateDepositAsync(Job job)
    {
        var deposit = await Finance().EnsureDepositAsync(job, _actor);
        await UnitOfWork.SaveChangesAsync();
        return deposit!;
    }

    private void PayAll()
    {
        foreach (var fee in _context.ServiceFees.Where(f => f.Status != ServiceFeeStates.Paid))
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
        var job = SeedJob(target: 10);
        await CreateDepositAsync(job);
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
        var job = SeedJob(target: 10);
        await CreateDepositAsync(job);
        MarkCounted(Enumerable.Range(0, 4).Select(_ => SeedDelivery(job)).ToList());

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        // 4 × 600,000 = 2,400,000 < deposit 3,000,000: 600,000 goes back to the Client.
        result.Kind.Should().Be(ServiceFeeKinds.Credit);
        result.Amount.Should().Be(600_000m);
    }

    [Fact]
    public async Task Settle_DepositCoversExactly_ShouldRecordPaidZeroSettlement()
    {
        var job = SeedJob(target: 10);
        await CreateDepositAsync(job);
        MarkCounted(Enumerable.Range(0, 5).Select(_ => SeedDelivery(job)).ToList());

        var result = await Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        result.Kind.Should().Be(ServiceFeeKinds.Settlement);
        result.Amount.Should().Be(0m);
        result.Status.Should().Be(ServiceFeeStates.Paid);
    }

    [Fact]
    public async Task Settle_CalledTwice_ShouldReturnTheSameFee()
    {
        var job = SeedJob(target: 10);
        await CreateDepositAsync(job);
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
        await CreateDepositAsync(job);
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
    public async Task Settle_NotSourcingJob_ShouldBeRejected()
    {
        var job = SeedJob();
        job.ServiceType!.Code = "HEADHUNT_COD";
        _context.SaveChanges();

        var act = () => Settlement().Handle(new SettleSourcingJobCommand(job.JobId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("JOB_NOT_SOURCING");
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
    public async Task ApproveSourcingCommission_InsideDisputeWindow_ShouldBeRejected()
    {
        var job = SeedJob(target: 1);
        await CreateDepositAsync(job);
        var delivery = SeedDelivery(job, reviewDueAt: DateTime.UtcNow.AddDays(3));
        await AcceptAsync(job, delivery);
        PayAll();

        var act = () => Settlement().Handle(new ApproveCommissionCommand(_context.Commissions.Single().CommissionId, _actor), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("SOURCING_DISPUTE_WINDOW_OPEN");
    }

    [Fact]
    public async Task ApproveSourcingCommission_PaidAndWindowOver_ShouldBecomePayable()
    {
        var job = SeedJob(target: 1);
        await CreateDepositAsync(job);
        var delivery = SeedDelivery(job, reviewDueAt: DateTime.UtcNow.AddSeconds(2));
        await AcceptAsync(job, delivery);
        PayAll();
        delivery.ReviewDueAt = DateTime.UtcNow.AddMinutes(-1);
        _context.SaveChanges();

        var result = await Settlement().Handle(new ApproveCommissionCommand(_context.Commissions.Single().CommissionId, _actor), default);

        result.Status.Should().Be(CommissionStates.Payable);
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
}
