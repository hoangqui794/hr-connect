using System;

namespace HRConnect.Application.Features.Admin.Dashboard;

/// <summary>
/// Money moved on one Vietnam-time day (VND only, like the revenue report's primary currency).
/// Days without any movement are not returned; the handler zero-fills the series.
/// </summary>
public sealed record DashboardCashflowDay(
    DateOnly Date,
    decimal ServiceFeesPaidAmount,
    decimal RefundsPaidAmount,
    decimal PostingFeesPaidAmount,
    decimal PayoutsAmount);

/// <summary>Activity counted on one Vietnam-time day. Empty days are not returned.</summary>
public sealed record DashboardActivityDay(
    DateOnly Date,
    int NewUsers,
    int AuditEvents,
    int ApprovalsCompleted);

/// <summary>Point-in-time KPIs for the admin dashboard. Amounts are VND.</summary>
public sealed record DashboardKpiSnapshot(
    int PendingApprovals,
    int ActiveUsers,
    int SuspendedUsers,
    int AuditEventsToday,
    int OverdueServiceFeesCount,
    decimal OverdueServiceFeesAmount,
    int PayableCommissionsCount,
    decimal PayableCommissionsAmount,
    int OpenDisputesCount);

/// <summary>Distinct users holding a role through an active, non-revoked assignment.</summary>
public sealed record DashboardRoleCount(string Role, int Count);
