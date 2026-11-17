using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Features.Admin.Dashboard;
using HRConnect.Application.Features.Reports.Queries.GetReportRevenue;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin;

/// <summary>
/// GET /api/v1/admin/dashboard/metrics. EF InMemory does not translate GroupBy like PostgreSQL:
/// these tests check results, not SQL.
/// </summary>
public class AdminDashboardMetricsTests
{
    // 12:00 on 17/11/2026 in Vietnam.
    private static readonly DateTime NowUtc = new(2026, 11, 17, 5, 0, 0, DateTimeKind.Utc);
    private static readonly DateOnly TodayVn = new(2026, 11, 17);

    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private GetAdminDashboardMetricsQueryHandler Handler =>
        new(new ReportRepository(_context), new FixedTimeProvider(new DateTimeOffset(NowUtc)));

    private Task<AdminDashboardMetricsDto> GetAsync(string? range) =>
        Handler.Handle(new GetAdminDashboardMetricsQuery(range), default);

    private static DateTime Utc(int month, int day, int hour, int minute = 0) =>
        new(2026, month, day, hour, minute, 0, DateTimeKind.Utc);

    private static ServiceFee Fee(string kind, string status, decimal amount, DateTime? paidAt, string currency = "VND") => new()
    {
        ServiceFeeId = Guid.NewGuid(),
        CompanyId = Guid.NewGuid(),
        Kind = kind,
        Status = status,
        Amount = amount,
        CurrencyCode = currency,
        PaidAt = paidAt,
        CreatedAt = paidAt ?? NowUtc,
        UpdatedAt = paidAt ?? NowUtc
    };

    private static JobPostingFee PostingFee(string status, decimal amount, DateTime? paidAt) => new()
    {
        PostingFeeId = Guid.NewGuid(),
        JobId = Guid.NewGuid(),
        PackageId = Guid.NewGuid(),
        CompanyId = Guid.NewGuid(),
        Amount = amount,
        CurrencyCode = "VND",
        Status = status,
        PaidAt = paidAt,
        PaymentReference = amount == 0 ? "FREE_TIER" : "REF",
        CreatedAt = paidAt ?? NowUtc,
        UpdatedAt = paidAt ?? NowUtc
    };

    // Payout.Commission is a required navigation: the revenue query joins it, so seed a real commission.
    private static Payout Payout(string status, decimal amount, DateTime? payoutDate) => new()
    {
        PayoutId = Guid.NewGuid(),
        Commission = new Commission
        {
            CommissionId = Guid.NewGuid(),
            AttributionId = Guid.NewGuid(),
            Amount = amount,
            Status = CommissionStates.Paid,
            RuleSnapshot = "{}",
            CalculationSnapshot = "{}",
            CreatedAt = NowUtc,
            UpdatedAt = NowUtc
        },
        Amount = amount,
        Status = status,
        PayoutDate = payoutDate,
        RecordedBy = Guid.NewGuid(),
        CreatedAt = payoutDate ?? NowUtc,
        UpdatedAt = payoutDate ?? NowUtc
    };

    private static AppUser User(string status = UserAccountStates.Active, DateTime? createdAt = null) => new()
    {
        UserId = Guid.NewGuid(),
        Email = $"{Guid.NewGuid():N}@test.com",
        PasswordHash = "x",
        Status = status,
        CreatedAt = createdAt ?? Utc(1, 1, 0),
        UpdatedAt = createdAt ?? Utc(1, 1, 0)
    };

    // -------------------------------------------------------------------------
    // Range and zero-fill
    // -------------------------------------------------------------------------

    [Theory]
    [InlineData("7d", 7)]
    [InlineData("30d", 30)]
    [InlineData("90d", 90)]
    public async Task Range_Returns_One_Zero_Filled_Point_Per_Day_Including_Today(string range, int days)
    {
        var result = await GetAsync(range);

        result.Range.Should().Be(range);
        result.CurrencyCode.Should().Be("VND");
        result.GeneratedAtUtc.Should().Be(NowUtc);

        var expectedDates = Enumerable.Range(0, days)
            .Select(i => TodayVn.AddDays(i - (days - 1)).ToString("yyyy-MM-dd"))
            .ToList();
        result.CashflowSeries.Select(p => p.Date).Should().Equal(expectedDates);
        result.ActivitySeries.Select(p => p.Date).Should().Equal(expectedDates);

        result.CashflowSeries.Should().OnlyContain(p =>
            p.ServiceFeesPaidAmount == 0 && p.RefundsPaidAmount == 0 && p.PostingFeesPaidAmount == 0 && p.PayoutsAmount == 0);
        result.ActivitySeries.Should().OnlyContain(p => p.NewUsers == 0 && p.AuditEvents == 0 && p.ApprovalsCompleted == 0);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("365d")]
    public async Task Invalid_Range_Falls_Back_To_30d(string? range)
    {
        var result = await GetAsync(range);

        result.Range.Should().Be("30d");
        result.CashflowSeries.Should().HaveCount(30);
        result.ActivitySeries.Should().HaveCount(30);
    }

    [Fact]
    public async Task Range_Is_Case_And_Whitespace_Insensitive()
    {
        var result = await GetAsync(" 7D ");

        result.Range.Should().Be("7d");
        result.CashflowSeries.Should().HaveCount(7);
    }

    [Fact]
    public async Task Days_With_Data_Are_Filled_And_Others_Stay_Zero()
    {
        await _context.ServiceFees.AddAsync(Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 10_000_000m, Utc(11, 14, 3)));
        await _context.SaveChangesAsync();

        var result = await GetAsync("7d");

        result.CashflowSeries.Single(p => p.Date == "2026-11-14").ServiceFeesPaidAmount.Should().Be(10_000_000m);
        result.CashflowSeries.Where(p => p.Date != "2026-11-14").Should().OnlyContain(p => p.ServiceFeesPaidAmount == 0);
    }

    // -------------------------------------------------------------------------
    // Cash flow
    // -------------------------------------------------------------------------

    [Fact]
    public async Task Credit_And_Replacement_Refund_Are_Not_Counted_As_Service_Fees_Paid()
    {
        var day = Utc(11, 15, 3);
        await _context.ServiceFees.AddRangeAsync(
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 30_000_000m, day),
            Fee(ServiceFeeKinds.Deposit, ServiceFeeStates.Paid, 5_000_000m, day),
            Fee(ServiceFeeKinds.Settlement, ServiceFeeStates.Paid, 2_000_000m, day),
            Fee(ServiceFeeKinds.Credit, ServiceFeeStates.Paid, 1_000_000m, day),
            Fee(ServiceFeeKinds.ReplacementRefund, ServiceFeeStates.Paid, 4_000_000m, day),
            // Not paid / not VND: never counted.
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Overdue, 99_000_000m, null),
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 1_000m, day, "USD"));
        await _context.SaveChangesAsync();

        var point = (await GetAsync("7d")).CashflowSeries.Single(p => p.Date == "2026-11-15");

        point.ServiceFeesPaidAmount.Should().Be(37_000_000m);
        point.RefundsPaidAmount.Should().Be(5_000_000m);
    }

    [Fact]
    public async Task Only_Completed_Payouts_Are_Counted()
    {
        var day = Utc(11, 16, 2);
        await _context.Payouts.AddRangeAsync(
            Payout(PayoutStates.Completed, 9_000_000m, day),
            Payout(PayoutStates.Failed, 1_000_000m, day),
            Payout(PayoutStates.Pending, 2_000_000m, day),
            Payout(PayoutStates.Cancelled, 3_000_000m, day));
        await _context.SaveChangesAsync();

        var point = (await GetAsync("7d")).CashflowSeries.Single(p => p.Date == "2026-11-16");

        point.PayoutsAmount.Should().Be(9_000_000m);
    }

    [Fact]
    public async Task Free_Tier_And_Unpaid_Posting_Fees_Are_Not_Counted()
    {
        var day = Utc(11, 16, 2);
        await _context.JobPostingFees.AddRangeAsync(
            PostingFee("PAID", 2_500_000m, day),
            PostingFee("PAID", 0m, day),
            PostingFee("PENDING", 7_000_000m, null),
            PostingFee("CANCELLED", 1_000_000m, day));
        await _context.SaveChangesAsync();

        var point = (await GetAsync("7d")).CashflowSeries.Single(p => p.Date == "2026-11-16");

        point.PostingFeesPaidAmount.Should().Be(2_500_000m);
    }

    [Fact]
    public async Task Money_Is_Grouped_By_Vietnam_Day_Not_Utc_Day()
    {
        await _context.ServiceFees.AddRangeAsync(
            // 23:30 UTC on 15/11 = 06:30 on 16/11 in Vietnam.
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 1_000_000m, Utc(11, 15, 23, 30)),
            // 16:59 UTC on 15/11 = 23:59 on 15/11 in Vietnam.
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 2_000_000m, Utc(11, 15, 16, 59)));
        await _context.SaveChangesAsync();

        var series = (await GetAsync("7d")).CashflowSeries;

        series.Single(p => p.Date == "2026-11-16").ServiceFeesPaidAmount.Should().Be(1_000_000m);
        series.Single(p => p.Date == "2026-11-15").ServiceFeesPaidAmount.Should().Be(2_000_000m);
    }

    [Fact]
    public async Task Money_Outside_The_Vietnam_Range_Is_Excluded()
    {
        // 7d = 11/11..17/11 in Vietnam = [10/11 17:00 UTC, 17/11 17:00 UTC).
        await _context.ServiceFees.AddRangeAsync(
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 1_000_000m, Utc(11, 10, 16, 59)),
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 2_000_000m, Utc(11, 10, 17, 0)));
        await _context.SaveChangesAsync();

        var series = (await GetAsync("7d")).CashflowSeries;

        series.Sum(p => p.ServiceFeesPaidAmount).Should().Be(2_000_000m);
        series.First().ServiceFeesPaidAmount.Should().Be(2_000_000m);
    }

    [Fact]
    public async Task Cashflow_Totals_Reconcile_With_The_Revenue_Report_For_The_Same_Period()
    {
        var day = Utc(11, 14, 4);
        await _context.ServiceFees.AddRangeAsync(
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Paid, 30_000_000m, day),
            Fee(ServiceFeeKinds.Deposit, ServiceFeeStates.Paid, 6_000_000m, Utc(11, 12, 20)),
            Fee(ServiceFeeKinds.Settlement, ServiceFeeStates.Paid, 3_000_000m, day),
            Fee(ServiceFeeKinds.Credit, ServiceFeeStates.Paid, 1_500_000m, day),
            Fee(ServiceFeeKinds.ReplacementRefund, ServiceFeeStates.Paid, 4_000_000m, Utc(11, 16, 23, 30)));
        await _context.JobPostingFees.AddRangeAsync(
            PostingFee("PAID", 2_500_000m, day),
            PostingFee("PAID", 0m, day));
        await _context.Payouts.AddRangeAsync(
            Payout(PayoutStates.Completed, 9_000_000m, day),
            Payout(PayoutStates.Failed, 1_000_000m, day));
        await _context.SaveChangesAsync();

        var dashboard = await GetAsync("30d");
        var revenue = await new GetReportRevenueQueryHandler(new ReportRepository(_context))
            .Handle(new GetReportRevenueQuery(TodayVn.AddDays(-29), TodayVn, "MONTH"), default);

        var serviceFees = dashboard.CashflowSeries.Sum(p => p.ServiceFeesPaidAmount);
        var refunds = dashboard.CashflowSeries.Sum(p => p.RefundsPaidAmount);
        var reportServiceFees = revenue.Totals["HEADHUNT_COD"].Collected + revenue.Totals["CV_SOURCING"].Collected;

        serviceFees.Should().Be(39_000_000m);
        refunds.Should().Be(5_500_000m);
        reportServiceFees.Should().Be(33_500_000m);
        (serviceFees - refunds).Should().Be(reportServiceFees);

        var postingFees = dashboard.CashflowSeries.Sum(p => p.PostingFeesPaidAmount);
        postingFees.Should().Be(2_500_000m);
        postingFees.Should().Be(revenue.Totals["CV_APPLICATION"].Collected);

        var payouts = dashboard.CashflowSeries.Sum(p => p.PayoutsAmount);
        payouts.Should().Be(9_000_000m);
        payouts.Should().Be(revenue.Commission.Paid);
    }

    // -------------------------------------------------------------------------
    // KPIs
    // -------------------------------------------------------------------------

    [Fact]
    public async Task Overdue_Kpi_Excludes_Fees_Owed_To_The_Client()
    {
        await _context.ServiceFees.AddRangeAsync(
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Overdue, 45_000_000m, null),
            Fee(ServiceFeeKinds.Settlement, ServiceFeeStates.Overdue, 5_000_000m, null),
            Fee(ServiceFeeKinds.Credit, ServiceFeeStates.Overdue, 1_000_000m, null),
            Fee(ServiceFeeKinds.ReplacementRefund, ServiceFeeStates.Overdue, 2_000_000m, null),
            Fee(ServiceFeeKinds.Placement, ServiceFeeStates.Due, 7_000_000m, null));
        await _context.SaveChangesAsync();

        var kpis = (await GetAsync("30d")).Kpis;

        kpis.OverdueServiceFeesCount.Should().Be(2);
        kpis.OverdueServiceFeesAmount.Should().Be(50_000_000m);
    }

    [Fact]
    public async Task Kpis_Count_Approvals_Users_Audit_Today_Commissions_And_Disputes()
    {
        var applicant = User(UserAccountStates.Pending);
        await _context.AppUsers.AddRangeAsync(
            applicant,
            User(),
            User(),
            User(UserAccountStates.Suspended),
            User(UserAccountStates.Locked));

        await _context.AffiliateApplications.AddRangeAsync(
            new AffiliateApplication { AffiliateApplicationId = Guid.NewGuid(), UserId = applicant.UserId, AffiliateType = "INDIVIDUAL", SubmittedData = "{}", Status = "UNDER_REVIEW", SubmittedAt = Utc(11, 1, 0) },
            new AffiliateApplication { AffiliateApplicationId = Guid.NewGuid(), UserId = Guid.NewGuid(), AffiliateType = "INDIVIDUAL", SubmittedData = "{}", Status = "PENDING", SubmittedAt = Utc(11, 1, 0) });
        await _context.CompanyVerificationRequests.AddRangeAsync(
            new CompanyVerificationRequest { CompanyVerificationRequestId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), SubmittedBy = Guid.NewGuid(), SubmittedPayload = "{}", Status = "UNDER_REVIEW", SubmittedAt = Utc(11, 1, 0) },
            new CompanyVerificationRequest { CompanyVerificationRequestId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), SubmittedBy = Guid.NewGuid(), SubmittedPayload = "{}", Status = "APPROVED", SubmittedAt = Utc(11, 1, 0), ReviewedAt = Utc(11, 2, 0) });

        // Today starts at 17:00 UTC on 16/11 (00:00 on 17/11 in Vietnam).
        await _context.AuditLogs.AddRangeAsync(
            new AuditLog { Action = "A", CreatedAt = Utc(11, 16, 16, 59) },
            new AuditLog { Action = "B", CreatedAt = Utc(11, 16, 17, 0) },
            new AuditLog { Action = "C", CreatedAt = Utc(11, 17, 4) });

        Commission NewCommission(string status, decimal amount) => new()
        {
            CommissionId = Guid.NewGuid(),
            AttributionId = Guid.NewGuid(),
            Amount = amount,
            Status = status,
            RuleSnapshot = "{}",
            CalculationSnapshot = "{}",
            CreatedAt = NowUtc,
            UpdatedAt = NowUtc
        };
        await _context.Commissions.AddRangeAsync(
            NewCommission(CommissionStates.Payable, 10_000_000m),
            NewCommission(CommissionStates.Payable, 8_500_000m),
            NewCommission(CommissionStates.Earned, 1_000_000m),
            NewCommission(CommissionStates.Paid, 2_000_000m));

        Dispute NewDispute(string status) => new()
        {
            DisputeId = Guid.NewGuid(),
            DisputeType = DisputeTypes.Attribution,
            RaisedBy = Guid.NewGuid(),
            Description = "d",
            Evidence = "[]",
            Status = status,
            CreatedAt = NowUtc,
            UpdatedAt = NowUtc
        };
        await _context.Disputes.AddRangeAsync(
            NewDispute(DisputeStates.Open),
            NewDispute(DisputeStates.UnderReview),
            NewDispute(DisputeStates.Upheld),
            NewDispute(DisputeStates.Rejected));
        await _context.SaveChangesAsync();

        var kpis = (await GetAsync("7d")).Kpis;

        kpis.PendingApprovals.Should().Be(2);
        kpis.ActiveUsers.Should().Be(2);
        kpis.SuspendedUsers.Should().Be(1);
        kpis.AuditEventsToday.Should().Be(2);
        kpis.PayableCommissionsCount.Should().Be(2);
        kpis.PayableCommissionsAmount.Should().Be(18_500_000m);
        kpis.OpenDisputesCount.Should().Be(2);
    }

    // -------------------------------------------------------------------------
    // Activity
    // -------------------------------------------------------------------------

    [Fact]
    public async Task Activity_Counts_New_Users_Audit_Events_And_Completed_Reviews_Per_Vietnam_Day()
    {
        await _context.AppUsers.AddRangeAsync(
            User(createdAt: Utc(11, 15, 23, 30)),  // 16/11 in Vietnam
            User(createdAt: Utc(11, 16, 1)));
        await _context.AuditLogs.AddAsync(new AuditLog { Action = "A", CreatedAt = Utc(11, 16, 2) });
        await _context.AffiliateApplications.AddAsync(new AffiliateApplication
        {
            AffiliateApplicationId = Guid.NewGuid(), UserId = Guid.NewGuid(), AffiliateType = "INDIVIDUAL", SubmittedData = "{}",
            Status = "APPROVED", SubmittedAt = Utc(11, 1, 0), ReviewedAt = Utc(11, 16, 3)
        });
        await _context.CompanyVerificationRequests.AddAsync(new CompanyVerificationRequest
        {
            CompanyVerificationRequestId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), SubmittedBy = Guid.NewGuid(), SubmittedPayload = "{}",
            Status = "REJECTED", SubmittedAt = Utc(11, 1, 0), ReviewedAt = Utc(11, 16, 4)
        });
        await _context.SaveChangesAsync();

        var point = (await GetAsync("7d")).ActivitySeries.Single(p => p.Date == "2026-11-16");

        point.NewUsers.Should().Be(2);
        point.AuditEvents.Should().Be(1);
        point.ApprovalsCompleted.Should().Be(2);
    }

    // -------------------------------------------------------------------------
    // Role breakdown
    // -------------------------------------------------------------------------

    [Fact]
    public async Task Role_Breakdown_Returns_All_Five_Roles_And_Skips_Revoked_Assignments()
    {
        var roles = RoleCodes.All.ToDictionary(code => code, code => new Role
        {
            RoleId = Guid.NewGuid(),
            Code = code,
            Name = code,
            IsSystem = true,
            IsActive = true,
            CreatedAt = NowUtc,
            UpdatedAt = NowUtc
        });
        await _context.Roles.AddRangeAsync(roles.Values);

        var candidateAffiliate = User();
        var candidate = User();
        var revokedAffiliate = User();
        var admin = User();
        await _context.AppUsers.AddRangeAsync(candidateAffiliate, candidate, revokedAffiliate, admin);

        UserRole Assign(AppUser user, string role, string status = UserRoleAssignmentStates.Active, DateTime? revokedAt = null) => new()
        {
            UserId = user.UserId,
            RoleId = roles[role].RoleId,
            AssignmentSource = "SYSTEM",
            AssignedAt = NowUtc,
            Status = status,
            RevokedAt = revokedAt
        };
        await _context.UserRoles.AddRangeAsync(
            Assign(candidateAffiliate, RoleCodes.Candidate),
            Assign(candidateAffiliate, RoleCodes.Affiliate),
            Assign(candidate, RoleCodes.Candidate),
            Assign(revokedAffiliate, RoleCodes.Affiliate, "REVOKED", NowUtc),
            Assign(admin, RoleCodes.PlatformAdmin),
            // Status still ACTIVE but revoked: not counted either.
            Assign(admin, RoleCodes.InternalHr, UserRoleAssignmentStates.Active, NowUtc));
        await _context.SaveChangesAsync();

        var breakdown = (await GetAsync("30d")).UserRoleBreakdown.ToDictionary(r => r.Role, r => r.Count);

        breakdown.Keys.Should().BeEquivalentTo(RoleCodes.All);
        breakdown[RoleCodes.Candidate].Should().Be(2);
        breakdown[RoleCodes.Affiliate].Should().Be(1);
        breakdown[RoleCodes.ClientCompanyUser].Should().Be(0);
        breakdown[RoleCodes.InternalHr].Should().Be(0);
        breakdown[RoleCodes.PlatformAdmin].Should().Be(1);
    }
}
