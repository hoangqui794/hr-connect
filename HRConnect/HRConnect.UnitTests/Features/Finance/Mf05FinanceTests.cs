using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Commands.Settlement;
using HRConnect.Application.Features.Finance.Commands.WarrantyClaims;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Finance.Queries;
using HRConnect.Application.Features.Finance.ReplacementSlots;
using HRConnect.Application.Features.Settings;
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
        Repository, _audit.Object, new BusinessSettingsService(new SystemSettingRepository(_context)), NullLogger<PlacementFinanceService>.Instance);

    private SettlementCommandHandlers Settlement() => new(Repository, UnitOfWork, _audit.Object);

    private WarrantyProgressService Progress() => new(Repository, UnitOfWork, _audit.Object);

    private ResolveResignationCommandHandler Resolve() => new(
        Repository, UnitOfWork, _audit.Object, new BusinessSettingsService(new SystemSettingRepository(_context)));

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
            CurrencyCode = "VND", SalaryBasis = OfferSalaryBasisCodes.Gross, SalaryPeriod = OfferSalaryPeriodCodes.Monthly,
            Status = OfferStates.Accepted, ConcurrencyToken = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now,
        };
        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(), ApplicationId = application.ApplicationId, OfferId = offer.OfferId,
            ActualStartDate = Start, Status = PlacementStates.Started, ConfirmedAt = now, CreatedAt = now, UpdatedAt = now,
            Application = application,
        };
        var company = new Company
        {
            CompanyId = _companyId, CompanyName = "ABC Technology", VerificationStatus = "VERIFIED", CreatedAt = now, UpdatedAt = now,
        };
        var candidate = new Candidate
        {
            CandidateId = application.CandidateId, FullName = "Nguyễn Văn Nam", ProfileVisibility = "PRIVATE", Status = "ACTIVE",
            CreatedAt = now, UpdatedAt = now,
        };
        // Real databases guarantee these through foreign keys; required-navigation includes need them here too.
        if (!_context.Companies.Local.Any(c => c.CompanyId == _companyId))
        {
            _context.Add(company);
        }

        _context.AddRange(candidate, job, application, offer, placement);
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

    [Fact]
    public async Task ReplacementSlotLookup_ReturnsEarliestOpenUnexpiredSlotForJob()
    {
        var now = DateTime.UtcNow;
        var jobId = Guid.NewGuid();
        var earliest = NewSlot(jobId, ReplacementSlotStates.Open, now.AddDays(-2), now.AddDays(10));
        var later = NewSlot(jobId, ReplacementSlotStates.Open, now.AddDays(-1), now.AddDays(10));
        var expired = NewSlot(jobId, ReplacementSlotStates.Open, now.AddDays(-3), now.AddSeconds(-1));
        var filled = NewSlot(jobId, ReplacementSlotStates.Filled, now.AddDays(-4), now.AddDays(10));
        var otherJob = NewSlot(Guid.NewGuid(), ReplacementSlotStates.Open, now.AddDays(-5), now.AddDays(10));
        _context.ReplacementSlots.AddRange(later, expired, filled, otherJob, earliest);
        await _context.SaveChangesAsync();

        var result = await Repository.GetEarliestOpenReplacementSlotForJobAsync(jobId, now);

        result.Should().NotBeNull();
        result!.ReplacementSlotId.Should().Be(earliest.ReplacementSlotId);
    }

    private static ReplacementSlot NewSlot(
        Guid jobId,
        string status,
        DateTime openedAt,
        DateTime expiresAt) => new()
        {
            ReplacementSlotId = Guid.NewGuid(),
            JobId = jobId,
            OriginalPlacementId = Guid.NewGuid(),
            ServiceFeeId = Guid.NewGuid(),
            Status = status,
            FillWindowDays = 30,
            OpenedAt = openedAt,
            ExpiresAt = expiresAt,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = openedAt,
            UpdatedAt = openedAt
        };

    // ---- placement start ------------------------------------------------------------------

    [Fact]
    public async Task HeadhuntPlacement_creates_30_day_warranty_fee_and_in_warranty_commission()
    {
        var (placement, offer) = await SeedPlacementAsync();

        var result = await InitializeAsync(placement, offer);

        result.Applicable.Should().BeTrue();
        result.Warnings.Should().BeEmpty();
        var warranty = await _context.Warranties.SingleAsync();
        warranty.Status.Should().Be(WarrantyStates.Active);
        warranty.EndDate.Should().Be(Start.AddDays(30));
        var fee = await _context.ServiceFees.SingleAsync();
        fee.Amount.Should().Be(30_000_000m); // 20M × 1.5 (default fee multiplier, QUY-TAC-PHI mục 5)
        fee.Status.Should().Be(ServiceFeeStates.Pending);
        var commission = await CommissionAsync();
        commission.Amount.Should().Be(9_000_000m); // 30% of the 30M fee
        commission.Status.Should().Be(CommissionStates.InWarranty); // E3: started, inside the warranty window
        commission.MilestoneType.Should().Be(CommissionMilestoneCodes.WarrantyPassed);
    }

    [Fact]
    public async Task Admin_configured_numbers_apply_to_new_placements()
    {
        var admin = Guid.NewGuid();
        var handlers = new BusinessSettingHandlers(new SystemSettingRepository(_context), UnitOfWork, _audit.Object);
        await handlers.Handle(new UpdateBusinessSettingCommand(BusinessSettingKeys.HeadhuntFeeMultiplier, 2m, admin), default);
        await handlers.Handle(new UpdateBusinessSettingCommand(BusinessSettingKeys.HeadhuntWarrantyDays, 45m, admin), default);
        var (placement, offer) = await SeedPlacementAsync();

        await InitializeAsync(placement, offer);

        var fee = await _context.ServiceFees.SingleAsync();
        fee.FeeMultiplier.Should().Be(2m);
        fee.Amount.Should().Be(40_000_000m);
        fee.DueDate.Should().Be(Start.AddDays(20)); // default payment due days from the HEADHUNT_COD document
        (await _context.Warranties.SingleAsync()).EndDate.Should().Be(Start.AddDays(45));
    }

    [Fact]
    public async Task AnnualGrossSalary_is_normalized_to_monthly_before_calculating_service_fee()
    {
        var (placement, offer) = await SeedPlacementAsync(240_000_000m);
        offer.SalaryPeriod = OfferSalaryPeriodCodes.Annual;

        await InitializeAsync(placement, offer);

        var fee = await _context.ServiceFees.SingleAsync();
        fee.BaseSalary.Should().Be(20_000_000m);
        fee.Amount.Should().Be(30_000_000m);
    }

    [Fact]
    public async Task HeadhuntFinance_rejects_net_salary()
    {
        var (placement, offer) = await SeedPlacementAsync();
        offer.SalaryBasis = OfferSalaryBasisCodes.Net;

        var act = () => InitializeAsync(placement, offer);

        var exception = await act.Should().ThrowAsync<BadRequestException>();
        exception.Which.ErrorCode.Should().Be(OfferSalaryErrorCodes.HeadhuntRequiresGross);
        (await _context.ServiceFees.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task Terms_on_the_job_win_over_admin_defaults()
    {
        var handlers = new BusinessSettingHandlers(new SystemSettingRepository(_context), UnitOfWork, _audit.Object);
        await handlers.Handle(new UpdateBusinessSettingCommand(BusinessSettingKeys.HeadhuntFeeMultiplier, 2m, _actor), default);
        var (placement, offer) = await SeedPlacementAsync();

        await FinanceService().InitializeAsync(
            placement,
            new JobApplicationContext(placement.ApplicationId, _companyId, _serviceTypeId, ServiceTypeCodesForTest.Headhunt, offer,
                FeeMultiplier: 1.8m, WarrantyDays: 60, PaymentDueDays: 10),
            _actor);
        await _context.SaveChangesAsync();

        var fee = await _context.ServiceFees.SingleAsync();
        fee.FeeMultiplier.Should().Be(1.8m);
        fee.Amount.Should().Be(36_000_000m);
        fee.DueDate.Should().Be(Start.AddDays(10));
        (await _context.Warranties.SingleAsync()).EndDate.Should().Be(Start.AddDays(60));
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

        var resolved = await Resolve().Handle(
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

        var resolved = await Resolve().Handle(
            new ResolveResignationCommand(placement.PlacementId, false, "Ứng viên vẫn đi làm", _actor), default);

        resolved.WarrantyStatus.Should().Be(WarrantyStates.Active);
        (await CommissionAsync()).Status.Should().Be(CommissionStates.InWarranty); // E2.3: back to the warranty window, not ON_HOLD
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
            .Invoking(h => h.Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(60), "x", _actor), default))
            .Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Warranty_list_is_scoped_to_the_clients_company_and_filters_by_status()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        await ReportHandler().Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(3), "Nghỉ", _actor), default);

        GetWarrantiesQuery Query(string? status) => new(_actor, status, 1, 20);
        FinanceQueryHandlers HandlersFor(Guid companyId)
        {
            var companyUsers = new Mock<ICompanyUserRepository>();
            companyUsers.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CompanyUser { CompanyId = companyId, UserId = _actor, Status = "ACTIVE" });
            return new FinanceQueryHandlers(Repository, companyUsers.Object);
        }

        var own = await HandlersFor(_companyId).Handle(Query("CLAIMED"), default);
        own.TotalCount.Should().Be(1);
        own.Items.Single().CommissionStatus.Should().Be(CommissionStates.OnHold);
        (await HandlersFor(_companyId).Handle(Query("PASSED"), default)).TotalCount.Should().Be(0);
        (await HandlersFor(Guid.NewGuid()).Handle(Query(null), default)).TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Bank_details_are_only_listed_when_requested()
    {
        var (placement, offer) = await SeedPlacementAsync();
        var attribution = await _context.Attributions.SingleAsync();
        var user = new AppUser { UserId = Guid.NewGuid(), Email = "aff@example.com", PasswordHash = "x", Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        _context.Add(user);
        _context.Add(new AffiliateProfile
        {
            AffiliateId = attribution.AffiliateId, UserId = user.UserId, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", BankName = "Vietcombank", BankAccountNumber = "0123456789",
            BankAccountHolder = "NGUYEN VAN HUNG", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();
        await InitializeAsync(placement, offer);
        var handlers = new FinanceQueryHandlers(Repository, Mock.Of<ICompanyUserRepository>());

        var withBank = await handlers.Handle(new GetCommissionsQuery(null, null, 1, 20, IncludeBankDetails: true), default);
        var withoutBank = await handlers.Handle(new GetCommissionsQuery(null, null, 1, 20), default);

        withBank.Items.Single().AffiliateBank!.BankAccountNumber.Should().Be("0123456789");
        withoutBank.Items.Single().AffiliateBank.Should().BeNull();
    }

    // ---- E2/E3: IN_WARRANTY and ON_HOLD (mf05-viec-can-lam-theo-quy-tac-phi.md) -------------

    [Fact]
    public async Task Commission_under_a_resignation_review_is_not_earned_when_the_warranty_ends()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        await ReportHandler().Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(5), "Nghỉ", _actor), default);
        (await CommissionAsync()).Status.Should().Be(CommissionStates.OnHold);

        // The claim makes the warranty CLAIMED, so the clock cannot pass it or earn the ON_HOLD commission.
        (await Progress().CompleteWarrantyAsync(placement.PlacementId, Start.AddDays(60))).Should().BeFalse();
        (await CommissionAsync()).Status.Should().Be(CommissionStates.OnHold);
    }

    [Fact]
    public async Task Rejected_claim_lets_the_clock_earn_the_commission_afterwards()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        await ReportHandler().Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(5), "Nghỉ", _actor), default);
        await Resolve().Handle(
            new ResolveResignationCommand(placement.PlacementId, false, "Ứng viên vẫn đi làm", _actor), default);

        (await Progress().CompleteWarrantyAsync(placement.PlacementId, Start.AddDays(30))).Should().BeTrue();

        (await CommissionAsync()).Status.Should().Be(CommissionStates.Earned);
    }

    [Fact]
    public async Task Confirmed_resignation_cancels_the_held_commission()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        await ReportHandler().Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(5), "Nghỉ", _actor), default);

        await Resolve().Handle(
            new ResolveResignationCommand(placement.PlacementId, true, "Đã xác minh", _actor), default);

        (await CommissionAsync()).Status.Should().Be(CommissionStates.Cancelled);
    }

    [Fact]
    public async Task In_warranty_commission_cannot_be_approved_and_the_message_names_no_fixed_days()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        var commissionId = (await CommissionAsync()).CommissionId;

        var act = () => Settlement().Handle(new ApproveCommissionCommand(commissionId, _actor), default);

        var error = await act.Should().ThrowAsync<ConflictException>();
        error.Which.Message.Should().Contain("IN_WARRANTY").And.NotContain("60 ngày");
    }

    // ---- E4: service fee DUE -------------------------------------------------------------------

    private async Task<ServiceFee> FeeDueOnAsync(DateOnly dueDate)
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        var fee = await _context.ServiceFees.SingleAsync();
        fee.DueDate = dueDate;
        _context.CompanyUsers.Add(new CompanyUser
        {
            CompanyUserId = Guid.NewGuid(), CompanyId = fee.CompanyId, UserId = Guid.NewGuid(), Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();
        return fee;
    }

    [Fact]
    public async Task Fee_within_the_reminder_window_becomes_DUE_and_the_client_is_reminded()
    {
        var today = new DateOnly(2026, 10, 15);
        var fee = await FeeDueOnAsync(today.AddDays(5));
        var notifications = new Mock<INotificationRepository>();
        var progress = new WarrantyProgressService(Repository, UnitOfWork, _audit.Object, notifications.Object);

        (await progress.MarkServiceFeeDueAsync(fee.ServiceFeeId, today, reminderDays: 5)).Should().BeTrue();

        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Due);
        notifications.Verify(n => n.AddAsync(
            It.Is<Notification>(x => x.NotificationType == "COMPANY" && x.RelatedEntityId == fee.ServiceFeeId && x.Message.Contains("còn 5 ngày")),
            It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == AuditActions.ServiceFeeDue), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Fee_outside_the_reminder_window_stays_PENDING()
    {
        var today = new DateOnly(2026, 10, 15);
        var fee = await FeeDueOnAsync(today.AddDays(6));

        (await Progress().MarkServiceFeeDueAsync(fee.ServiceFeeId, today, reminderDays: 5)).Should().BeFalse();

        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Pending);
    }

    [Fact]
    public async Task Due_fee_becomes_OVERDUE_after_the_due_date()
    {
        var today = new DateOnly(2026, 10, 15);
        var fee = await FeeDueOnAsync(today.AddDays(2));
        await Progress().MarkServiceFeeDueAsync(fee.ServiceFeeId, today, reminderDays: 5);

        (await Repository.GetOverdueServiceFeeIdsAsync(today.AddDays(3), 10)).Should().Contain(fee.ServiceFeeId);
        (await Progress().MarkServiceFeeOverdueAsync(fee.ServiceFeeId, today.AddDays(3))).Should().BeTrue();
        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Overdue);
    }

    [Fact]
    public async Task Payment_is_accepted_while_the_fee_is_DUE()
    {
        var today = new DateOnly(2026, 10, 15);
        var fee = await FeeDueOnAsync(today.AddDays(1));
        await Progress().MarkServiceFeeDueAsync(fee.ServiceFeeId, today, reminderDays: 5);

        var paid = await Settlement().Handle(
            new RecordServiceFeePaymentCommand(fee.ServiceFeeId, DateTime.UtcNow.AddMinutes(-1), "UNC-1", _actor), default);

        paid.Status.Should().Be(ServiceFeeStates.Paid);
    }

    [Fact]
    public void Reminder_days_is_a_configurable_setting()
    {
        var reminder = BusinessSettingKeys.All.Single(s => s.Key == BusinessSettingKeys.FeeDueReminderDays);
        reminder.DefaultValue.Should().Be(5m);
        reminder.Min.Should().Be(1m);
        reminder.Max.Should().Be(30m);
    }

    // ---- replacement slots (docs/MF05/mf05-thiet-ke-suat-thay-the.md) -----------------------

    /// <summary>Placement started, Client reported the resignation; the fee is paid when <paramref name="feePaid"/>.</summary>
    private async Task<(Placement Placement, ServiceFee Fee)> ResignationReportedAsync(bool feePaid, string jobStatus = "ACTIVE")
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        var fee = await _context.ServiceFees.SingleAsync();
        if (feePaid)
        {
            fee.Status = ServiceFeeStates.Paid;
            fee.PaidAt = DateTime.UtcNow;
        }

        placement.Application.Job.Status = jobStatus;
        await _context.SaveChangesAsync();
        await ReportHandler().Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(5), "Nghỉ", _actor), default);
        return (placement, fee);
    }

    private Task<WarrantyClaimResponse> ConfirmResignationAsync(Guid placementId) =>
        Resolve().Handle(new ResolveResignationCommand(placementId, true, "Đã xác minh", _actor), default);

    [Fact]
    public async Task Confirmed_resignation_with_paid_fee_opens_a_slot_for_the_configured_window()
    {
        var (placement, fee) = await ResignationReportedAsync(feePaid: true);

        var resolved = await ConfirmResignationAsync(placement.PlacementId);

        var slot = await _context.ReplacementSlots.SingleAsync();
        slot.Status.Should().Be(ReplacementSlotStates.Open);
        slot.ServiceFeeId.Should().Be(fee.ServiceFeeId);
        slot.OriginalPlacementId.Should().Be(placement.PlacementId);
        slot.FillWindowDays.Should().Be(30);
        slot.ExpiresAt.Should().Be(slot.OpenedAt!.Value.AddDays(30));
        resolved.Replacement.Should().NotBeNull();
        resolved.Replacement!.Status.Should().Be(ReplacementSlotStates.Open);
        // R4: the fee is kept, not refunded.
        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Paid);
    }

    [Fact]
    public async Task Confirmed_resignation_with_unpaid_fee_waits_for_payment_then_opens()
    {
        var (placement, fee) = await ResignationReportedAsync(feePaid: false);

        var resolved = await ConfirmResignationAsync(placement.PlacementId);

        resolved.Replacement!.Status.Should().Be(ReplacementSlotStates.WaitingPayment);
        resolved.Replacement.ExpiresAt.Should().BeNull();

        await Settlement().Handle(new RecordServiceFeePaymentCommand(fee.ServiceFeeId, DateTime.UtcNow, "VCB-REPL", _actor), default);

        var slot = await _context.ReplacementSlots.SingleAsync();
        slot.Status.Should().Be(ReplacementSlotStates.Open);
        slot.OpenedAt.Should().NotBeNull();
        slot.ExpiresAt.Should().Be(slot.OpenedAt!.Value.AddDays(30));
    }

    [Fact]
    public async Task Opening_a_slot_reopens_a_closed_job_with_a_history_row()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true, jobStatus: "CLOSED");

        await ConfirmResignationAsync(placement.PlacementId);

        var job = await _context.Jobs.Include(j => j.JobStatusHistories).SingleAsync();
        job.Status.Should().Be("ACTIVE");
        job.JobStatusHistories.Should().ContainSingle(h =>
            h.OldStatus == "CLOSED" && h.NewStatus == "ACTIVE" && h.ReasonCode == ReplacementSlotErrorCodes.JobReopenedReason);
    }

    [Fact]
    public async Task Replacement_who_also_leaves_gets_no_second_slot()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);
        placement.ReplacementSlotId = Guid.NewGuid(); // this leaver was already the replacement (R1)
        await _context.SaveChangesAsync();

        var resolved = await ConfirmResignationAsync(placement.PlacementId);

        resolved.Replacement.Should().BeNull();
        (await _context.ReplacementSlots.AnyAsync()).Should().BeFalse();
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == AuditActions.ReplacementNotAllowed), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Rejected_resignation_opens_no_slot()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);

        var resolved = await Resolve().Handle(new ResolveResignationCommand(placement.PlacementId, false, "Vẫn đi làm", _actor), default);

        resolved.Replacement.Should().BeNull();
        (await _context.ReplacementSlots.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task Open_slot_expires_only_after_its_deadline()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);
        await ConfirmResignationAsync(placement.PlacementId);
        var slot = await _context.ReplacementSlots.SingleAsync();

        (await Progress().ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value.AddMinutes(-1))).Should().BeFalse();
        (await Repository.GetExpiredReplacementSlotIdsAsync(slot.ExpiresAt!.Value, 10)).Should().Contain(slot.ReplacementSlotId);
        (await Progress().ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value)).Should().BeTrue();

        (await _context.ReplacementSlots.SingleAsync()).Status.Should().Be(ReplacementSlotStates.Expired);
    }

    [Fact]
    public async Task Cancel_needs_the_current_token_and_an_open_or_waiting_slot()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);
        await ConfirmResignationAsync(placement.PlacementId);
        var slot = await _context.ReplacementSlots.SingleAsync();
        var handler = new CancelReplacementSlotCommandHandler(Repository, UnitOfWork, _audit.Object);

        var stale = () => handler.Handle(new CancelReplacementSlotCommand(slot.ReplacementSlotId, "Client không cần", Guid.NewGuid(), _actor), default);
        (await stale.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be(ReplacementSlotErrorCodes.ConcurrencyConflict);

        var cancelled = await handler.Handle(
            new CancelReplacementSlotCommand(slot.ReplacementSlotId, "Client không cần", slot.ConcurrencyToken, _actor), default);
        cancelled.Status.Should().Be(ReplacementSlotStates.Cancelled);
        cancelled.CancelReason.Should().Be("Client không cần");

        var again = () => handler.Handle(
            new CancelReplacementSlotCommand(slot.ReplacementSlotId, "Lần nữa", cancelled.ConcurrencyToken, _actor), default);
        (await again.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be(ReplacementSlotErrorCodes.NotCancellable);
    }

    [Fact]
    public async Task Client_only_sees_slots_of_its_own_company()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);
        await ConfirmResignationAsync(placement.PlacementId);
        var otherCompanyUser = new Mock<ICompanyUserRepository>();
        otherCompanyUser.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = Guid.NewGuid(), UserId = _actor, Status = "ACTIVE" });
        var ownCompanyUser = new Mock<ICompanyUserRepository>();
        ownCompanyUser.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = _companyId, UserId = _actor, Status = "ACTIVE" });
        var query = new GetJobReplacementSlotsQuery(placement.Application.JobId, _actor);

        var hidden = () => new GetJobReplacementSlotsQueryHandler(Repository, otherCompanyUser.Object).Handle(query, default);
        await hidden.Should().ThrowAsync<NotFoundException>();

        var slots = await new GetJobReplacementSlotsQueryHandler(Repository, ownCompanyUser.Object).Handle(query, default);
        slots.Should().ContainSingle().Which.OriginalCandidateName.Should().Be("Nguyễn Văn Nam");
    }

    [Fact]
    public void Fill_window_is_a_configurable_setting()
    {
        var setting = BusinessSettingKeys.All.Single(s => s.Key == BusinessSettingKeys.ReplacementFillWindowDays);
        setting.DefaultValue.Should().Be(30m);
        setting.Min.Should().Be(1m);
        setting.Max.Should().Be(180m);
    }

    // ---- approval and payout ----------------------------------------------------------------

    private async Task<Commission> EarnedCommissionAsync()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        await Progress().CompleteWarrantyAsync(placement.PlacementId, Start.AddDays(60));
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
