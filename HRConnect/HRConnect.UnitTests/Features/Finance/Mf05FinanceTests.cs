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

    private WarrantyProgressService ReconciliationAwareProgress() => new(
        Repository,
        UnitOfWork,
        _audit.Object,
        reconciliationRepository: new PlacementReconciliationRepository(_context));

    private ResolveResignationCommandHandler Resolve() => new(
        Repository, UnitOfWork, _audit.Object, new BusinessSettingsService(new SystemSettingRepository(_context)));

    // ---- setup ---------------------------------------------------------------------------

    private async Task<(Placement Placement, Offer Offer)> SeedPlacementAsync(decimal? salary = 20_000_000m, bool attribution = true, bool rule = true)
    {
        var now = DateTime.UtcNow;
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = _companyId, ServiceTypeId = _serviceTypeId, CreatedBy = Guid.NewGuid(),
            Title = ".NET Developer", CurrencyCode = "VND", Quantity = 1, Status = "ACTIVE",
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
    public async Task RecordServiceFeePayment_WhenReconciliationIsPending_IsRejected()
    {
        var (placement, offer) = await SeedPlacementAsync();
        var finance = await InitializeAsync(placement, offer);
        _context.PlacementReconciliations.Add(new PlacementReconciliation
        {
            ReconciliationId = Guid.NewGuid(),
            ApplicationId = placement.ApplicationId,
            PlacementId = placement.PlacementId,
            ClaimedOutcome = PlacementReconciliationOutcomes.Started,
            Status = PlacementReconciliationStates.Pending,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        var action = () => Settlement().Handle(
            new RecordServiceFeePaymentCommand(finance.ServiceFeeId!.Value, DateTime.UtcNow, "UC41-PENDING", _actor), default);

        await action.Should().ThrowAsync<ConflictException>()
            .WithMessage("*hoàn tất đối soát*");
        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Pending);
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
    public async Task ReplacementPlacement_creates_new_warranty_and_commission_but_no_second_service_fee()
    {
        var (originalPlacement, originalOffer) = await SeedPlacementAsync();
        await InitializeAsync(originalPlacement, originalOffer);
        var originalFee = await _context.ServiceFees.SingleAsync();
        originalFee.Status = ServiceFeeStates.Paid;

        var now = DateTime.UtcNow;
        var replacementCandidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Người thay thế",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };
        var replacementApplication = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            JobId = originalPlacement.Application.JobId,
            CandidateId = replacementCandidate.CandidateId,
            Status = ApplicationStates.Placed,
            AppliedAt = now,
            UpdatedAt = now,
            ConcurrencyToken = Guid.NewGuid(),
            Job = originalPlacement.Application.Job,
            Candidate = replacementCandidate
        };
        var replacementOffer = new Offer
        {
            OfferId = Guid.NewGuid(),
            ApplicationId = replacementApplication.ApplicationId,
            OfferVersion = 1,
            Salary = 22_000_000m,
            CurrencyCode = "VND",
            SalaryBasis = OfferSalaryBasisCodes.Gross,
            SalaryPeriod = OfferSalaryPeriodCodes.Monthly,
            Status = OfferStates.Accepted,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = now,
            UpdatedAt = now
        };
        var replacementPlacement = new Placement
        {
            PlacementId = Guid.NewGuid(),
            ApplicationId = replacementApplication.ApplicationId,
            OfferId = replacementOffer.OfferId,
            ActualStartDate = Start.AddDays(5),
            Status = PlacementStates.Started,
            ReplacementSlotId = Guid.NewGuid(),
            ConfirmedAt = now,
            CreatedAt = now,
            UpdatedAt = now,
            Application = replacementApplication,
            Offer = replacementOffer
        };
        _context.AddRange(replacementCandidate, replacementApplication, replacementOffer, replacementPlacement);
        _context.Add(new Attribution
        {
            AttributionId = Guid.NewGuid(),
            ApplicationId = replacementApplication.ApplicationId,
            AffiliateId = Guid.NewGuid(),
            WinningSubmissionId = Guid.NewGuid(),
            AttributionRule = "FIRST_ACCEPTED_SUBMISSION",
            Status = "ACTIVE",
            EstablishedAt = now,
            UpdatedAt = now
        });
        await _context.SaveChangesAsync();

        var result = await FinanceService().InitializeAsync(
            replacementPlacement,
            new JobApplicationContext(
                replacementApplication.ApplicationId,
                _companyId,
                _serviceTypeId,
                ServiceTypeCodesForTest.Headhunt,
                replacementOffer,
                ReplacementSourceServiceFee: originalFee),
            _actor);
        await _context.SaveChangesAsync();

        result.Applicable.Should().BeTrue();
        result.ServiceFeeId.Should().BeNull();
        result.ServiceFeeAmount.Should().BeNull();
        (await _context.ServiceFees.CountAsync()).Should().Be(1);
        var replacementWarranty = await _context.Warranties.SingleAsync(w => w.PlacementId == replacementPlacement.PlacementId);
        replacementWarranty.StartDate.Should().Be(replacementPlacement.ActualStartDate);
        replacementWarranty.EndDate.Should().Be(replacementPlacement.ActualStartDate.AddDays(30));
        var replacementCommission = await _context.Commissions.SingleAsync(c => c.PlacementId == replacementPlacement.PlacementId);
        replacementCommission.Status.Should().Be(CommissionStates.InWarranty);
        replacementCommission.BaseAmount.Should().Be(originalFee.Amount);
        replacementCommission.Amount.Should().Be(originalFee.Amount * 30m / 100m);
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
    public async Task Affiliate_is_told_when_the_commission_is_held_then_cancelled()
    {
        var (placement, offer) = await SeedPlacementAsync();
        var attribution = await _context.Attributions.SingleAsync();
        var affiliateUser = new AppUser { UserId = Guid.NewGuid(), Email = "aff@example.com", PasswordHash = "x", Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        _context.Add(affiliateUser);
        _context.Add(new AffiliateProfile
        {
            AffiliateId = attribution.AffiliateId, UserId = affiliateUser.UserId, AffiliateType = "STANDARD", Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();
        await InitializeAsync(placement, offer);

        var notifier = new Mock<IAppNotifier>();
        var companyUsers = new Mock<ICompanyUserRepository>();
        companyUsers.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = _companyId, UserId = _actor, Status = "ACTIVE" });
        await new ReportResignationCommandHandler(Repository, companyUsers.Object, UnitOfWork, _audit.Object, notifier.Object)
            .Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(10), "Ứng viên xin nghỉ", _actor), default);
        await new ResolveResignationCommandHandler(
                Repository, UnitOfWork, _audit.Object, new BusinessSettingsService(new SystemSettingRepository(_context)), notifier: notifier.Object)
            .Handle(new ResolveResignationCommand(placement.PlacementId, true, "Đã xác minh", _actor), default);

        notifier.Verify(n => n.NotifyUsersAsync(
            It.Is<IEnumerable<Guid>>(ids => ids.Single() == affiliateUser.UserId),
            It.Is<AppNotice>(a => a.Title == "Hoa hồng đang tạm giữ" && a.RouteHint == "/affiliate/commissions"),
            It.IsAny<CancellationToken>()), Times.Once);
        notifier.Verify(n => n.NotifyUsersAsync(
            It.Is<IEnumerable<Guid>>(ids => ids.Single() == affiliateUser.UserId),
            It.Is<AppNotice>(a => a.Title == "Hoa hồng đã bị hủy"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Candidate_is_notified_when_hr_confirms_resignation()
    {
        var (placement, offer) = await SeedPlacementAsync();
        var candidateUser = new AppUser { UserId = Guid.NewGuid(), Email = "candidate@example.com", PasswordHash = "x", Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var candidate = await _context.Candidates.SingleAsync(c => c.CandidateId == placement.Application.CandidateId);
        candidate.UserId = candidateUser.UserId;
        _context.Add(candidateUser);
        await _context.SaveChangesAsync();
        await InitializeAsync(placement, offer);

        var notifier = new Mock<IAppNotifier>();
        var companyUsers = new Mock<ICompanyUserRepository>();
        companyUsers.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = _companyId, UserId = _actor, Status = "ACTIVE" });
        await new ReportResignationCommandHandler(Repository, companyUsers.Object, UnitOfWork, _audit.Object, notifier.Object)
            .Handle(new ReportResignationCommand(placement.PlacementId, Start.AddDays(10), "Ứng viên xin nghỉ", _actor), default);

        await new ResolveResignationCommandHandler(
                Repository, UnitOfWork, _audit.Object, new BusinessSettingsService(new SystemSettingRepository(_context)), notifier: notifier.Object)
            .Handle(new ResolveResignationCommand(placement.PlacementId, true, "Đã xác minh", _actor), default);

        notifier.Verify(n => n.NotifyUsersAsync(
            It.Is<IEnumerable<Guid>>(ids => ids.Single() == candidateUser.UserId),
            It.Is<AppNotice>(a => a.Title == "Hồ sơ nhận việc đã kết thúc" && a.NotificationType == "PLACEMENT" && a.RouteHint == "/candidate/applications"),
            It.IsAny<CancellationToken>()), Times.Once);
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
        own.Items.Single().ServiceFeeAmount.Should().NotBeNull();
        (await HandlersFor(_companyId).Handle(Query("PASSED"), default)).TotalCount.Should().Be(0);
        (await HandlersFor(Guid.NewGuid()).Handle(Query(null), default)).TotalCount.Should().Be(0);

        // Platform roles (no company scope) still see the commission.
        var platform = await HandlersFor(_companyId).Handle(new GetWarrantiesQuery(null, "CLAIMED", 1, 20), default);
        platform.Items.Single().CommissionStatus.Should().Be(CommissionStates.OnHold);
        platform.Items.Single().CommissionAmount.Should().NotBeNull();
    }

    // HR feedback 28/10: the Client only sees its service fee, never the Affiliate's commission.
    [Fact]
    public async Task Client_warranty_list_never_contains_the_affiliate_commission()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        var companyUsers = new Mock<ICompanyUserRepository>();
        companyUsers.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = _companyId, UserId = _actor, Status = "ACTIVE" });

        var item = (await new FinanceQueryHandlers(Repository, companyUsers.Object)
            .Handle(new GetWarrantiesQuery(_actor, null, 1, 20), default)).Items.Single();

        item.ServiceFeeAmount.Should().NotBeNull();
        item.CommissionAmount.Should().BeNull();
        item.CommissionStatus.Should().BeNull();
    }

    // HR feedback 28/10: the Affiliate only sees its commission, never the Client's service fee (BaseAmount).
    [Fact]
    public async Task Affiliate_commission_list_never_contains_the_client_fee()
    {
        var (placement, offer) = await SeedPlacementAsync();
        var attribution = await _context.Attributions.SingleAsync();
        var user = new AppUser { UserId = Guid.NewGuid(), Email = "aff@example.com", PasswordHash = "x", Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        _context.Add(user);
        _context.Add(new AffiliateProfile
        {
            AffiliateId = attribution.AffiliateId, UserId = user.UserId, AffiliateType = "STANDARD", Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();
        await InitializeAsync(placement, offer);
        var handlers = new FinanceQueryHandlers(Repository, Mock.Of<ICompanyUserRepository>());

        var own = (await handlers.Handle(new GetCommissionsQuery(user.UserId, null, 1, 20), default)).Items.Single();
        var platform = (await handlers.Handle(new GetCommissionsQuery(null, null, 1, 20), default)).Items.Single();

        own.Amount.Should().BeGreaterThan(0);
        own.BaseAmount.Should().BeNull();
        platform.BaseAmount.Should().NotBeNull();
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
            AffiliateId = attribution.AffiliateId, UserId = user.UserId, AffiliateType = "STANDARD", Status = "ACTIVE", BankName = "Vietcombank", BankAccountNumber = "0123456789",
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

    // ---- E2/E3: IN_WARRANTY and ON_HOLD (docs/main-flows.md, MF-05) -------------

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
    public async Task Pending_reconciliation_blocks_both_due_and_overdue_fee_transitions()
    {
        var today = new DateOnly(2026, 10, 15);
        var fee = await FeeDueOnAsync(today.AddDays(1));
        var placement = await _context.Placements.SingleAsync();
        _context.PlacementReconciliations.Add(new PlacementReconciliation
        {
            ReconciliationId = Guid.NewGuid(),
            ApplicationId = placement.ApplicationId,
            PlacementId = placement.PlacementId,
            ClaimedOutcome = PlacementReconciliationOutcomes.Started,
            Status = PlacementReconciliationStates.Pending,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();
        var progress = ReconciliationAwareProgress();

        (await progress.MarkServiceFeeDueAsync(fee.ServiceFeeId, today, reminderDays: 5)).Should().BeFalse();
        fee.DueDate = today.AddDays(-1);
        await _context.SaveChangesAsync();
        (await progress.MarkServiceFeeOverdueAsync(fee.ServiceFeeId, today)).Should().BeFalse();

        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Pending);
    }

    [Fact]
    public async Task Confirmed_reconciliation_allows_fee_to_become_due()
    {
        var today = new DateOnly(2026, 10, 15);
        var fee = await FeeDueOnAsync(today.AddDays(1));
        var placement = await _context.Placements.SingleAsync();
        _context.PlacementReconciliations.Add(new PlacementReconciliation
        {
            ReconciliationId = Guid.NewGuid(),
            ApplicationId = placement.ApplicationId,
            PlacementId = placement.PlacementId,
            ClaimedOutcome = PlacementReconciliationOutcomes.Started,
            Status = PlacementReconciliationStates.Confirmed,
            ReviewedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        });
        await _context.SaveChangesAsync();

        (await ReconciliationAwareProgress().MarkServiceFeeDueAsync(fee.ServiceFeeId, today, reminderDays: 5)).Should().BeTrue();
        (await _context.ServiceFees.SingleAsync()).Status.Should().Be(ServiceFeeStates.Due);
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

    // ---- Client dashboard summary ------------------------------------------------------------

    private readonly Guid _otherCompanyId = Guid.NewGuid();

    private Mock<ICompanyUserRepository> ClientOf(Guid companyId, string status = "ACTIVE")
    {
        var members = new Mock<ICompanyUserRepository>();
        members.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = companyId, UserId = _actor, Status = status });
        return members;
    }

    /// <summary>
    /// One company with: an overdue placement fee, a deposit due in 5 days, a paid fee, a credit owed to it,
    /// two delivered CVs, a warranty ending in 3 days and an open replacement slot; plus another company's fee.
    /// </summary>
    private async Task<Placement> DashboardDataAsync()
    {
        var (placement, offer) = await SeedPlacementAsync();
        await InitializeAsync(placement, offer);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var now = DateTime.UtcNow;

        var placementFee = await _context.ServiceFees.SingleAsync();
        placementFee.Status = ServiceFeeStates.Pending;
        placementFee.Amount = 6_000_000m;
        placementFee.DueDate = today.AddDays(-1);

        ServiceFee Fee(string kind, string status, decimal amount, DateOnly due, Guid? company = null) => new()
        {
            ServiceFeeId = Guid.NewGuid(), JobId = placement.Application.JobId, Kind = kind, CompanyId = company ?? _companyId,
            BaseSalary = amount, FeeMultiplier = 1m, Amount = amount, CurrencyCode = "VND", DueDate = due, Status = status,
            CreatedAt = now, UpdatedAt = now,
        };
        _context.AddRange(
            Fee(ServiceFeeKinds.Deposit, ServiceFeeStates.Pending, 1_000_000m, today.AddDays(5)),
            Fee(ServiceFeeKinds.Settlement, ServiceFeeStates.Paid, 9_000_000m, today.AddDays(1)),
            Fee(ServiceFeeKinds.Credit, ServiceFeeStates.Pending, 500_000m, today.AddDays(10)),
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Pending, 7_777_777m, today.AddDays(2), company: _otherCompanyId));

        SourcingDelivery Delivery(DateTime due, string status = SourcingDeliveryStates.Delivered) => new()
        {
            DeliveryId = Guid.NewGuid(), JobId = placement.Application.JobId, ApplicationId = placement.ApplicationId,
            Status = status, DeliveredAt = now, DeliveredBy = _actor, ReviewDueAt = due, CreatedAt = now, UpdatedAt = now,
        };
        _context.AddRange(Delivery(now.AddDays(5)), Delivery(now.AddDays(2)), Delivery(now.AddDays(1), SourcingDeliveryStates.Accepted));

        var warranty = await _context.Warranties.SingleAsync();
        warranty.Status = WarrantyStates.Active;
        warranty.EndDate = today.AddDays(3);

        _context.Add(new ReplacementSlot
        {
            ReplacementSlotId = Guid.NewGuid(), JobId = placement.Application.JobId, OriginalPlacementId = placement.PlacementId,
            ServiceFeeId = placementFee.ServiceFeeId, Status = ReplacementSlotStates.Open, FillWindowDays = 30,
            OpenedAt = now, ExpiresAt = now.AddDays(30), CreatedAt = now, UpdatedAt = now,
        });
        await _context.SaveChangesAsync();
        return placement;
    }

    [Fact]
    public async Task Client_dashboard_summary_adds_up_its_own_company_only()
    {
        await DashboardDataAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var summary = await new GetClientDashboardSummaryQueryHandler(Repository, ClientOf(_companyId).Object)
            .Handle(new GetClientDashboardSummaryQuery(_actor), default);

        summary.PendingFeesAmount.Should().Be(7_000_000m, "unpaid placement 6M + deposit 1M; the paid fee and other company are left out");
        summary.PendingFeesCount.Should().Be(2);
        summary.OverdueFeesAmount.Should().Be(6_000_000m, "the placement fee is past its due date");
        summary.OverdueFeesCount.Should().Be(1);
        summary.NextFeeDueDate.Should().Be(today.AddDays(5));
        summary.RefundsOwedAmount.Should().Be(500_000m);
        summary.RefundsOwedCount.Should().Be(1);
        summary.SourcingPendingReviewCount.Should().Be(2, "an accepted CV no longer waits for the Client");
        summary.SourcingNearestReviewDueAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(2), TimeSpan.FromMinutes(1));
        summary.WarrantiesEndingSoonCount.Should().Be(1);
        summary.WarrantyWithinDays.Should().Be(7);
        summary.OpenReplacementSlotsCount.Should().Be(1);
        summary.CurrencyCode.Should().Be("VND");
    }

    [Fact]
    public async Task Client_dashboard_summary_shows_nothing_of_another_company_and_respects_the_warranty_window()
    {
        await DashboardDataAsync();

        var other = await new GetClientDashboardSummaryQueryHandler(Repository, ClientOf(_otherCompanyId).Object)
            .Handle(new GetClientDashboardSummaryQuery(_actor), default);
        other.PendingFeesAmount.Should().Be(7_777_777m, "only that company's own fee");
        other.SourcingPendingReviewCount.Should().Be(0);
        other.WarrantiesEndingSoonCount.Should().Be(0);
        other.OpenReplacementSlotsCount.Should().Be(0);
        other.RefundsOwedAmount.Should().Be(0m);

        var narrow = await new GetClientDashboardSummaryQueryHandler(Repository, ClientOf(_companyId).Object)
            .Handle(new GetClientDashboardSummaryQuery(_actor, WarrantyWithinDays: 2), default);
        narrow.WarrantiesEndingSoonCount.Should().Be(0, "the warranty ends in 3 days");
    }

    [Fact]
    public async Task Client_dashboard_summary_rejects_a_user_without_an_active_membership()
    {
        await DashboardDataAsync();

        var inactive = () => new GetClientDashboardSummaryQueryHandler(Repository, ClientOf(_companyId, "INACTIVE").Object)
            .Handle(new GetClientDashboardSummaryQuery(_actor), default);
        await inactive.Should().ThrowAsync<ForbiddenException>();

        var none = new Mock<ICompanyUserRepository>();
        var noMember = () => new GetClientDashboardSummaryQueryHandler(Repository, none.Object)
            .Handle(new GetClientDashboardSummaryQuery(_actor), default);
        await noMember.Should().ThrowAsync<ForbiddenException>();
    }

    // ---- replacement slots (docs/main-flows.md (MF-05, suất thay thế)) -----------------------

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

    private WarrantyProgressService ProgressWithRefundPercent(decimal percent, int extensionDays = 0)
    {
        var settings = new Mock<IAdminBusinessSettings>();
        settings.Setup(s => s.GetDecimalAsync(BusinessSettingKeys.ReplacementRefundPercent, It.IsAny<CancellationToken>())).ReturnsAsync(percent);
        settings.Setup(s => s.GetIntAsync(BusinessSettingKeys.ReplacementExtensionDays, It.IsAny<CancellationToken>())).ReturnsAsync(extensionDays);
        settings.Setup(s => s.GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays, It.IsAny<CancellationToken>())).ReturnsAsync(20);
        return new WarrantyProgressService(Repository, UnitOfWork, _audit.Object, settings: settings.Object);
    }

    private async Task<ReplacementSlot> ExpiredSlotReadyAsync()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);
        await ConfirmResignationAsync(placement.PlacementId);
        return await _context.ReplacementSlots.SingleAsync();
    }

    [Fact]
    public async Task Unfilled_slot_is_extended_once_before_it_can_expire_and_refund()
    {
        var slot = await ExpiredSlotReadyAsync();
        var firstDeadline = slot.ExpiresAt!.Value;
        var progress = ProgressWithRefundPercent(30m, extensionDays: 15);

        (await progress.ExpireReplacementSlotAsync(slot.ReplacementSlotId, firstDeadline)).Should().BeTrue();

        var extended = await _context.ReplacementSlots.SingleAsync();
        extended.Status.Should().Be(ReplacementSlotStates.Open);
        extended.ExtendedAt.Should().Be(firstDeadline);
        extended.ExpiresAt.Should().Be(firstDeadline.AddDays(15));
        (await _context.ServiceFees.AnyAsync(f => f.Kind == ServiceFeeKinds.ReplacementRefund)).Should().BeFalse();
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == AuditActions.ReplacementSlotExtended), It.IsAny<CancellationToken>()), Times.Once);
        (await Repository.GetExpiredReplacementSlotIdsAsync(firstDeadline.AddDays(1), 10)).Should().NotContain(slot.ReplacementSlotId);

        (await progress.ExpireReplacementSlotAsync(slot.ReplacementSlotId, firstDeadline.AddDays(14))).Should().BeFalse();
        (await progress.ExpireReplacementSlotAsync(slot.ReplacementSlotId, firstDeadline.AddDays(15))).Should().BeTrue();

        var expired = await _context.ReplacementSlots.SingleAsync();
        expired.Status.Should().Be(ReplacementSlotStates.Expired);
        expired.ExtendedAt.Should().Be(firstDeadline);
        (await _context.ServiceFees.CountAsync(f => f.Kind == ServiceFeeKinds.ReplacementRefund)).Should().Be(1);
    }

    [Fact]
    public async Task Extension_days_of_zero_expires_the_slot_at_the_first_deadline()
    {
        var slot = await ExpiredSlotReadyAsync();

        (await ProgressWithRefundPercent(30m, extensionDays: 0).ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value)).Should().BeTrue();

        var expired = await _context.ReplacementSlots.SingleAsync();
        expired.Status.Should().Be(ReplacementSlotStates.Expired);
        expired.ExtendedAt.Should().BeNull();
    }

    [Fact]
    public async Task Expired_slot_with_nobody_sent_to_the_client_refunds_the_configured_share_of_the_fee()
    {
        var slot = await ExpiredSlotReadyAsync();
        var paid = await _context.ServiceFees.SingleAsync(f => f.ServiceFeeId == slot.ServiceFeeId);

        (await ProgressWithRefundPercent(30m).ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value)).Should().BeTrue();

        var refund = await _context.ServiceFees.SingleAsync(f => f.Kind == ServiceFeeKinds.ReplacementRefund);
        refund.Amount.Should().Be(decimal.Round(paid.Amount * 0.3m, 0, MidpointRounding.AwayFromZero));
        refund.BaseSalary.Should().Be(paid.Amount);
        refund.Status.Should().Be(ServiceFeeStates.Pending);
        refund.JobId.Should().Be(slot.JobId);
        (await _context.ServiceFees.SingleAsync(f => f.ServiceFeeId == slot.ServiceFeeId)).Status.Should().Be(ServiceFeeStates.Paid);
    }

    [Fact]
    public async Task Client_fee_list_names_who_left_and_when_the_slot_ran_out_on_a_refund()
    {
        var slot = await ExpiredSlotReadyAsync();
        (await ProgressWithRefundPercent(30m).ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value)).Should().BeTrue();
        var leaver = (await _context.Placements.Include(p => p.Application).ThenInclude(a => a.Candidate)
            .SingleAsync(p => p.PlacementId == slot.OriginalPlacementId)).Application.Candidate?.FullName;

        var fees = await new FinanceQueryHandlers(Repository, Mock.Of<ICompanyUserRepository>())
            .Handle(new GetServiceFeesQuery(null, null, 1, 20), default);

        var refund = fees.Items.Single(f => f.Kind == ServiceFeeKinds.ReplacementRefund);
        refund.CandidateName.Should().Be(leaver);
        refund.ReplacementExpiredAt.Should().Be(slot.ExpiresAt);
    }

    [Fact]
    public async Task Expired_slot_refunds_nothing_when_a_candidate_reached_the_client()
    {
        var slot = await ExpiredSlotReadyAsync();
        var now = DateTime.UtcNow;
        _context.ServiceTypes.Add(new ServiceType { ServiceTypeId = _serviceTypeId, Code = ServiceTypeCodesForTest.Headhunt, Name = "Tuyển qua Affiliate", IsActive = true });
        _context.Applications.Add(new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = slot.JobId, CandidateId = Guid.NewGuid(), Status = ApplicationStates.Shortlisted,
            AppliedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(), ReplacementSlotId = slot.ReplacementSlotId,
        });
        await _context.SaveChangesAsync();

        (await ProgressWithRefundPercent(30m).ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value)).Should().BeTrue();

        (await _context.ServiceFees.AnyAsync(f => f.Kind == ServiceFeeKinds.ReplacementRefund)).Should().BeFalse();
    }

    [Fact]
    public async Task Expired_slot_refunds_nothing_when_the_percent_is_zero()
    {
        var slot = await ExpiredSlotReadyAsync();

        (await ProgressWithRefundPercent(0m).ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value)).Should().BeTrue();

        (await _context.ServiceFees.AnyAsync(f => f.Kind == ServiceFeeKinds.ReplacementRefund)).Should().BeFalse();
    }

    [Fact]
    public async Task Fee_owed_to_the_client_is_not_reminded_or_marked_overdue()
    {
        var slot = await ExpiredSlotReadyAsync();
        await ProgressWithRefundPercent(30m).ExpireReplacementSlotAsync(slot.ReplacementSlotId, slot.ExpiresAt!.Value);
        var refund = await _context.ServiceFees.SingleAsync(f => f.Kind == ServiceFeeKinds.ReplacementRefund);

        (await Repository.GetOverdueServiceFeeIdsAsync(refund.DueDate.AddDays(1), 10)).Should().NotContain(refund.ServiceFeeId);
        (await Repository.GetServiceFeeIdsDueSoonAsync(refund.DueDate, refund.DueDate, 10)).Should().NotContain(refund.ServiceFeeId);
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
    public async Task Replacement_slot_list_is_scoped_to_the_client_company_and_carries_job_names()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);
        await ConfirmResignationAsync(placement.PlacementId);
        var ownCompanyUser = new Mock<ICompanyUserRepository>();
        ownCompanyUser.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = _companyId, UserId = _actor, Status = "ACTIVE" });
        var otherCompanyUser = new Mock<ICompanyUserRepository>();
        otherCompanyUser.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = Guid.NewGuid(), UserId = _actor, Status = "ACTIVE" });

        var own = await new GetReplacementSlotsQueryHandler(Repository, ownCompanyUser.Object)
            .Handle(new GetReplacementSlotsQuery(_actor, null, null, 1, 20), default);
        own.TotalCount.Should().Be(1);
        var slot = own.Items.Should().ContainSingle().Subject;
        slot.JobId.Should().Be(placement.Application.JobId);
        slot.JobTitle.Should().Be(".NET Developer");
        slot.CompanyName.Should().Be("ABC Technology");
        slot.OriginalCandidateName.Should().Be("Nguyễn Văn Nam");

        var other = await new GetReplacementSlotsQueryHandler(Repository, otherCompanyUser.Object)
            .Handle(new GetReplacementSlotsQuery(_actor, null, null, 1, 20), default);
        other.TotalCount.Should().Be(0);
        other.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Replacement_slot_list_lets_platform_roles_see_every_company_and_filters_by_job_and_status()
    {
        var (placement, _) = await ResignationReportedAsync(feePaid: true);
        await ConfirmResignationAsync(placement.PlacementId);
        var handler = new GetReplacementSlotsQueryHandler(Repository, new Mock<ICompanyUserRepository>().Object);

        var all = await handler.Handle(new GetReplacementSlotsQuery(null, null, null, 1, 20), default);
        all.Items.Should().ContainSingle().Which.CompanyName.Should().Be("ABC Technology");

        var byJob = await handler.Handle(new GetReplacementSlotsQuery(null, placement.Application.JobId, null, 1, 20), default);
        byJob.Items.Should().ContainSingle();

        var otherJob = await handler.Handle(new GetReplacementSlotsQuery(null, Guid.NewGuid(), null, 1, 20), default);
        otherJob.Items.Should().BeEmpty();

        var status = all.Items[0].Status;
        var sameStatus = await handler.Handle(new GetReplacementSlotsQuery(null, null, status.ToLowerInvariant(), 1, 20), default);
        sameStatus.Items.Should().ContainSingle();
        var cancelled = await handler.Handle(new GetReplacementSlotsQuery(null, null, ReplacementSlotStates.Cancelled, 1, 20), default);
        cancelled.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Replacement_slot_list_rejects_a_client_without_a_company_and_clamps_paging()
    {
        var noCompany = new Mock<ICompanyUserRepository>();
        noCompany.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>())).ReturnsAsync((CompanyUser?)null);
        var denied = () => new GetReplacementSlotsQueryHandler(Repository, noCompany.Object)
            .Handle(new GetReplacementSlotsQuery(_actor, null, null, 1, 20), default);
        await denied.Should().ThrowAsync<ForbiddenException>();

        var inactive = new Mock<ICompanyUserRepository>();
        inactive.Setup(r => r.GetByUserIdAsync(_actor, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyId = _companyId, UserId = _actor, Status = "INACTIVE" });
        var deactivated = () => new GetReplacementSlotsQueryHandler(Repository, inactive.Object)
            .Handle(new GetReplacementSlotsQuery(_actor, null, null, 1, 20), default);
        await deactivated.Should().ThrowAsync<ForbiddenException>();

        var paged = await new GetReplacementSlotsQueryHandler(Repository, noCompany.Object)
            .Handle(new GetReplacementSlotsQuery(null, null, null, 0, 1000), default);
        paged.Page.Should().Be(1);
        paged.PageSize.Should().Be(100);
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
