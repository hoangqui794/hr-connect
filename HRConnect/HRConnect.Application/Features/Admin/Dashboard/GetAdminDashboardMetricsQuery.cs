using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Reports.Common;
using MediatR;

namespace HRConnect.Application.Features.Admin.Dashboard;

/// <summary>Admin overview metrics. <paramref name="Range"/> is 7d, 30d or 90d; anything else means 30d.</summary>
public sealed record GetAdminDashboardMetricsQuery(string? Range) : IRequest<AdminDashboardMetricsDto>;

public sealed record AdminDashboardMetricsDto
{
    public string Range { get; init; } = string.Empty;
    public DateTime GeneratedAtUtc { get; init; }
    public string CurrencyCode { get; init; } = string.Empty;
    public DashboardKpiDto Kpis { get; init; } = new();
    public IReadOnlyList<CashflowPointDto> CashflowSeries { get; init; } = [];
    public IReadOnlyList<ActivityPointDto> ActivitySeries { get; init; } = [];
    public IReadOnlyList<RoleBreakdownDto> UserRoleBreakdown { get; init; } = [];
}

public sealed record DashboardKpiDto
{
    public int PendingApprovals { get; init; }
    public int ActiveUsers { get; init; }
    public int SuspendedUsers { get; init; }
    public int AuditEventsToday { get; init; }
    public int OverdueServiceFeesCount { get; init; }
    public decimal OverdueServiceFeesAmount { get; init; }
    public int PayableCommissionsCount { get; init; }
    public decimal PayableCommissionsAmount { get; init; }
    public int OpenDisputesCount { get; init; }
}

/// <summary>One Vietnam-time day. <c>Date</c> is yyyy-MM-dd.</summary>
public sealed record CashflowPointDto
{
    public string Date { get; init; } = string.Empty;
    /// <summary>PAID PLACEMENT / DEPOSIT / SETTLEMENT fees; refunds to the Client are excluded.</summary>
    public decimal ServiceFeesPaidAmount { get; init; }
    /// <summary>PAID CREDIT / REPLACEMENT_REFUND: money HR Connect returned to the Client.</summary>
    public decimal RefundsPaidAmount { get; init; }
    public decimal PostingFeesPaidAmount { get; init; }
    public decimal PayoutsAmount { get; init; }
}

/// <summary>One Vietnam-time day. <c>Date</c> is yyyy-MM-dd.</summary>
public sealed record ActivityPointDto
{
    public string Date { get; init; } = string.Empty;
    public int NewUsers { get; init; }
    public int AuditEvents { get; init; }
    public int ApprovalsCompleted { get; init; }
}

public sealed record RoleBreakdownDto
{
    public string Role { get; init; } = string.Empty;
    public int Count { get; init; }
}

public sealed class GetAdminDashboardMetricsQueryHandler : IRequestHandler<GetAdminDashboardMetricsQuery, AdminDashboardMetricsDto>
{
    public const string DefaultRange = "30d";
    private const string CurrencyCode = "VND";
    private const string DateFormat = "yyyy-MM-dd";

    private static readonly IReadOnlyDictionary<string, int> RangeDays = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["7d"] = 7,
        ["30d"] = 30,
        ["90d"] = 90
    };

    private readonly IReportRepository _reportRepository;
    private readonly TimeProvider _timeProvider;

    public GetAdminDashboardMetricsQueryHandler(IReportRepository reportRepository, TimeProvider? timeProvider = null)
    {
        _reportRepository = reportRepository;
        _timeProvider = timeProvider ?? TimeProvider.System;
    }

    public async Task<AdminDashboardMetricsDto> Handle(GetAdminDashboardMetricsQuery request, CancellationToken cancellationToken)
    {
        var rangeKey = NormalizeRange(request.Range);
        var days = RangeDays[rangeKey];

        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;
        var today = VietnamTime.Today(nowUtc);
        var range = ReportTimeRange.Create(today.AddDays(-(days - 1)), today);
        // 00:00 today in Vietnam, as UTC: the range ends at 00:00 tomorrow.
        var todayStartUtc = range.ToUtcPlusOne.AddDays(-1);

        // One DbContext: queries run one after another.
        var cashflow = await _reportRepository.GetDashboardCashflowByDayAsync(range, cancellationToken);
        var activity = await _reportRepository.GetDashboardActivityByDayAsync(range, cancellationToken);
        var kpis = await _reportRepository.GetDashboardKpisAsync(todayStartUtc, cancellationToken);
        var roles = await _reportRepository.GetDashboardUserRoleCountsAsync(cancellationToken);

        var cashflowByDay = cashflow.ToDictionary(c => c.Date);
        var activityByDay = activity.ToDictionary(a => a.Date);
        var allDays = Enumerable.Range(0, days).Select(i => range.FromDate.AddDays(i)).ToList();

        return new AdminDashboardMetricsDto
        {
            Range = rangeKey,
            GeneratedAtUtc = nowUtc,
            CurrencyCode = CurrencyCode,
            Kpis = new DashboardKpiDto
            {
                PendingApprovals = kpis.PendingApprovals,
                ActiveUsers = kpis.ActiveUsers,
                SuspendedUsers = kpis.SuspendedUsers,
                AuditEventsToday = kpis.AuditEventsToday,
                OverdueServiceFeesCount = kpis.OverdueServiceFeesCount,
                OverdueServiceFeesAmount = kpis.OverdueServiceFeesAmount,
                PayableCommissionsCount = kpis.PayableCommissionsCount,
                PayableCommissionsAmount = kpis.PayableCommissionsAmount,
                OpenDisputesCount = kpis.OpenDisputesCount
            },
            CashflowSeries = allDays.Select(day =>
            {
                var point = cashflowByDay.GetValueOrDefault(day);
                return new CashflowPointDto
                {
                    Date = day.ToString(DateFormat, CultureInfo.InvariantCulture),
                    ServiceFeesPaidAmount = point?.ServiceFeesPaidAmount ?? 0m,
                    RefundsPaidAmount = point?.RefundsPaidAmount ?? 0m,
                    PostingFeesPaidAmount = point?.PostingFeesPaidAmount ?? 0m,
                    PayoutsAmount = point?.PayoutsAmount ?? 0m
                };
            }).ToList(),
            ActivitySeries = allDays.Select(day =>
            {
                var point = activityByDay.GetValueOrDefault(day);
                return new ActivityPointDto
                {
                    Date = day.ToString(DateFormat, CultureInfo.InvariantCulture),
                    NewUsers = point?.NewUsers ?? 0,
                    AuditEvents = point?.AuditEvents ?? 0,
                    ApprovalsCompleted = point?.ApprovalsCompleted ?? 0
                };
            }).ToList(),
            UserRoleBreakdown = roles.Select(r => new RoleBreakdownDto { Role = r.Role, Count = r.Count }).ToList()
        };
    }

    /// <summary>7d / 30d / 90d (any case, trimmed); anything else falls back to 30d.</summary>
    public static string NormalizeRange(string? range)
    {
        var key = range?.Trim().ToLowerInvariant();
        return key != null && RangeDays.ContainsKey(key) ? key : DefaultRange;
    }
}
