using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Finance.Commands.WarrantyClaims;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Finance;

public class Mf05FinanceTests
{
    private static readonly DateOnly Start = new(2026, 9, 1);
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid _serviceTypeId = Guid.NewGuid();
    private readonly Guid _actor = Guid.NewGuid();

    private FinanceRepository Repository => new(_context);
    private UnitOfWork UnitOfWork => new(_context);

    private PlacementFinanceService FinanceService() => new(
        Repository, _audit.Object, Options.Create(new Mf05Settings()), NullLogger<PlacementFinanceService>.Instance);

    private SettlementCommandHandlers Settlement() => new(Repository, UnitOfWork, _audit.Object);

    private WarrantyProgressService Progress() => new(Repository, UnitOfWork, _audit.Object);

    // ---- setup ---------------------------------------------------------------------------

    private async Task<(Placement Placement, Offer Offer)> SeedPlacementAsync(decimal? salary = 20_000_000m, bool attribution = true, bool rule = true)
    {
        var now = DateTime.UtcNow;
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = _companyId, ServiceTypeId = _serviceTypeId, CreatedBy = Guid.NewGuid(),
            Title = ".NET Developer", CurrencyCode = "VND", Quantity = 1, Status = "ACTIVE", Visibility = "PUBLIC",
            CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = Guid.NewGuid(), Status = ApplicationStates.Placed,
            AppliedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(), Job = job,
        };
        var offer = new Offer
        {
            OfferId = Guid.NewGuid(), ApplicationId = application.ApplicationId, OfferVersion = 1, Salary = salary,
            CurrencyCode = "VND", Status = OfferStates.Accepted, ConcurrencyToken = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now,
        };
        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(), ApplicationId = application.ApplicationId, OfferId = offer.OfferId,
            ActualStartDate = Start, Status = PlacementStates.Started, ConfirmedAt = now, CreatedAt = now, UpdatedAt = now,
            Application = application,
        };
        _context.AddRange(job, application, offer, placement);
        if (attribution)
        {
            _context.Add(new Attribution
            {
                AttributionId = Guid.NewGuid(), ApplicationId = application.ApplicationId, AffiliateId = Guid.NewGuid(),
                WinningSubmissionId = Guid.NewGuid(), AttributionRule = "FIRST_ACCEPTED_SUBMISSION", Status = "ACTIVE",
                EstablishedAt = now, UpdatedAt = now,
            });
        }

        if (rule)
        {
            _context.Add(new CommissionRule
            {
                CommissionRuleId = Guid.NewGuid(), ServiceTypeId = _serviceTypeId, Name = "Default", RateType = "PERCENT",
                RateValue = 30m, MilestoneType = CommissionMilestoneCodes.WarrantyPassed, WarrantyRequired = true,
                IsActive = true, EffectiveFrom = now.AddDays(-1), CreatedAt = now, UpdatedAt = now,
            });
        }

        await _context.SaveChangesAsync();
        return (placement, offer);
    }

    private async Task<PlacementFinanceResult> InitializeAsync(Placement placement, Offer offer, string serviceType = ServiceTypeCodesForTest.Headhunt)
    {
        var result = await FinanceService().InitializeAsync(
            placement, new JobApplicationContext(placement.ApplicationId, _companyId, _serviceTypeId, serviceType, offer), _actor);
        await _context.SaveChangesAsync();
        return result;
    }

    private Task<Commission> CommissionAsync() => _context.Commissions.SingleAsync();

    private static class ServiceTypeCodesForTest
    {
        public const string Headhunt = "HEADHUNT_COD";
    }

    // ---- placement start ------------------------------------------------------------------

    [Fact]
    public async Task HeadhuntPlacement_creates_30_day_warranty_fee_and_pending_commission()
    {
        var (placement, offer) = await SeedPlacementAsync();

        var result = await InitializeAsync(placement, offer);

        result.Applicable.Should().BeTrue();
        result.Warnings.Should().BeEmpty();
        var warranty = await _context.Warranties.SingleAsync();
        warranty.Status.Should().Be(WarrantyStates.Active);
        warranty.EndDate.Should().Be(Start.AddDays(30));
        var fee = await _context.ServiceFees.SingleAsync();
        fee.Amount.Should().Be(30_000_000m); // 20M × 1.5
        fee.Status.Should().Be(ServiceFeeStates.Pending);
        var commission = await CommissionAsync();
        commission.Amount.Should().Be(9_000_000m); // 30% of the fee, all at once
        commission.Status.Should().Be(CommissionStates.Pending);
        commission.MilestoneType.Should().Be(CommissionMilestoneCodes.WarrantyPassed);
    }

    [Fact]
    public async Task OtherServiceTypes_create_no_finance_records()
    {
        var (placement, offer) = await SeedPlacementAsync();

        var result = await InitializeAsync(placement, offer, "CV_APPLICATION");

        result.Applicable.Should().BeFalse();
        (await _context.Warranties.AnyAsync()).Should().BeFalse();
        (await _context.ServiceFees.AnyAsync()).Should().BeFalse();
        (await _context.Commissions.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task Without_attribution_or_rule_no_commission_is_created_and_a_warning_explains_why()
    {
        var (placement, offer) = await SeedPlacementAsync(attribution: false);

        var result = await InitializeAsync(placement, offer);

        result.Warnings.Should().Contain("NO_AFFILIATE_ATTRIBUTION");
        (await _context.ServiceFees.AnyAsync()).Should().BeTrue();
        (await _context.Commissions.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task Missing_rule_is_reported()
    {
        var (placement, offer) = await SeedPlacementAsync(rule: false);

        (await InitializeAsync(placement, offer)).Warnings.Should().Contain("NO_ACTIVE_COMMISSION_RULE");
    }

    [Fact]
    public void Fixed_rule_pays_the_configured_amount()
    {
        var rule = new CommissionRule { RateType = "FIXED", RateValue = 15_000_000m, Name = "x" };

        PlacementFinanceService.CalculateCommission(rule, fee: null).Should().Be(15_000_000m);
    }

    // ---- 30-day warranty --------------------------------------------------------------------

    [Fact]
    public async Task Warranty_passes_on_day_30_and_earns_the_whole_commission()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);

        (await Progress().CompleteWarrantyAsync(placement.PlacementId, Start.AddDays(29))).Should().BeFalse();
        (await Progress().CompleteWarrantyAsync(placement.PlacementId, Start.AddDays(30))).Should().BeTrue();

        (await _context.Warranties.SingleAsync()).Status.Should().Be(WarrantyStates.Passed);
        var commission = await CommissionAsync();
        commission.Status.Should().Be(CommissionStates.Earned);
        commission.Amount.Should().Be(9_000_000m);
    }

    [Fact]
    public async Task Unpaid_fee_past_due_date_becomes_overdue()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        var fee = await _context.ServiceFees.SingleAsync();

        (await Progress().MarkServiceFeeOverdueAsync(fee.ServiceFeeId, fee.DueDate)).Should().BeFalse();
        (await Progress().MarkServiceFeeOverdueAsync(fee.ServiceFeeId, fee.DueDate.AddDays(1))).Should().BeTrue();

        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Overdue);
    }

    // ---- resignation within the warranty ----------------------------------------------------

    private ReportResignationCommandHandler ReportHandler(Guid? companyId = null)
    {
        var companyUsers = new Mock<ICompanyUserRepository>();
        companyUsers.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = companyId ?? _companyId, UserId = _actor, Status = "ACTIVE" });
        return new ReportResignationCommandHandler(Repository, companyUsers.Object, UnitOfWork, _audit.Object);
    }

    [Fact]
    public async Task Reported_resignation_holds_the_commission_and_confirmation_cancels_it()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);

        var reported = await ReportHandler().Handle(
            new ReportResignationCommand(placement.PlacementId, Start.AddDays(10), "Ứng viên xin nghỉ", _actor), default);
        reported.WarrantyStatus.Should().Be(WarrantyStates.Claimed);
        (await CommissionAsync()).Status.Should().Be(CommissionStates.OnHold);
        // A claimed warranty is never passed by the worker.
        (await Progress().CompleteWarrantyAsync(placement.PlacementId, Start.AddDays(40))).Should().BeFalse();

        var resolved = await new ResolveResignationCommandHandler(Repository, UnitOfWork, _audit.Object).Handle(
            new ResolveResignationCommand(placement.PlacementId, true, "Đã xác minh với ứng viên", _actor), default);

        resolved.WarrantyStatus.Should().Be(WarrantyStates.Voided);
        resolved.PlacementStatus.Should().Be(PlacementStates.LeftDuringWarranty);
        (await CommissionAsync()).Status.Should().Be(CommissionStates.Cancelled);
    }

    [Fact]
    public async Task Rejected_report_restores_the_warranty_and_commission()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        await ReportHandler().Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(5), "Nghỉ", _actor), default);

        var resolved = await new ResolveResignationCommandHandler(Repository, UnitOfWork, _audit.Object).Handle(
            new ResolveResignationCommand(placement.PlacementId, false, "Ứng viên vẫn đi làm", _actor), default);

        resolved.WarrantyStatus.Should().Be(WarrantyStates.Active);
        (await CommissionAsync()).Status.Should().Be(CommissionStates.Pending);
    }

    [Fact]
    public async Task Other_company_cannot_report_and_dates_must_fall_inside_the_warranty()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);

        await ReportHandler(Guid.NewGuid())
            .Invoking(h => h.Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(5), "x", _actor), default))
            .Should().ThrowAsync<NotFoundException>();
        await ReportHandler()
            .Invoking(h => h.Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(30), "x", _actor), default))
            .Should().ThrowAsync<BadRequestException>();
    }

    // ---- approval and payout ----------------------------------------------------------------

    private async Task<Commission> EarnedCommissionAsync()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        await Progress().CompleteWarrantyAsync(placement.PlacementId, Start.AddDays(30));
        return await CommissionAsync();
    }

    [Fact]
    public async Task Earned_commission_waits_for_the_client_payment_before_approval()
    {
        var commission = await EarnedCommissionAsync();

        var blocked = await Settlement()
            .Invoking(h => h.Handle(new ApproveCommissionCommand(commission.CommissionId, _actor), default))
            .Should().ThrowAsync<ConflictException>();
        blocked.Which.ErrorCode.Should().Be("SERVICE_FEE_NOT_PAID");

        var fee = await _context.ServiceFees.SingleAsync();
        await Settlement().Handle(new RecordServiceFeePaymentCommand(fee.ServiceFeeId, DateTime.UtcNow, "VCB-001", _actor), default);
        var approved = await Settlement().Handle(new ApproveCommissionCommand(commission.CommissionId, _actor), default);

        approved.Status.Should().Be(CommissionStates.Payable);
    }

    [Fact]
    public async Task Failed_payout_keeps_the_commission_payable_and_a_retry_marks_it_paid()
    {
        var commission = await EarnedCommissionAsync();
        var fee = await _context.ServiceFees.SingleAsync();
        await Settlement().Handle(new RecordServiceFeePaymentCommand(fee.ServiceFeeId, DateTime.UtcNow, "VCB-001", _actor), default);
        await Settlement().Handle(new ApproveCommissionCommand(commission.CommissionId, _actor), default);

        var failed = await Settlement().Handle(
            new RecordPayoutCommand(commission.CommissionId, false, DateTime.UtcNow, "BANK", null, null, _actor), default);
        failed.PayoutStatus.Should().Be(PayoutStates.Failed);
        failed.CommissionStatus.Should().Be(CommissionStates.Payable);

        var paid = await Settlement().Handle(
            new RecordPayoutCommand(commission.CommissionId, true, DateTime.UtcNow, "BANK", "FT123", null, _actor), default);
        paid.PayoutStatus.Should().Be(PayoutStates.Completed);
        paid.CommissionStatus.Should().Be(CommissionStates.Paid);
        paid.AttemptNo.Should().Be(2);
        paid.Amount.Should().Be(9_000_000m);
    }

    [Fact]
    public async Task Adjustment_keeps_the_old_and_new_amount()
    {
        var commission = await EarnedCommissionAsync();

        var adjusted = await Settlement().Handle(
            new AdjustCommissionCommand(commission.CommissionId, 8_000_000m, "Thỏa thuận lại với Affiliate", _actor), default);

        adjusted.Amount.Should().Be(8_000_000m);
        var adjustment = await _context.CommissionAdjustments.SingleAsync();
        adjustment.OldAmount.Should().Be(9_000_000m);
        adjustment.NewAmount.Should().Be(8_000_000m);
    }
}
