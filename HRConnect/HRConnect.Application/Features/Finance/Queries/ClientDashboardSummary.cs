using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Common;
using MediatR;

namespace HRConnect.Application.Features.Finance.Queries;

/// <summary>
/// Money and commitments of one Client company for the dashboard: what it owes, what it is owed,
/// sourcing CVs waiting for its answer, warranties about to end and open replacement slots.
/// </summary>
public sealed record ClientDashboardSummaryDto(
    decimal PendingFeesAmount,
    int PendingFeesCount,
    decimal OverdueFeesAmount,
    int OverdueFeesCount,
    DateOnly? NextFeeDueDate,
    decimal RefundsOwedAmount,
    int RefundsOwedCount,
    int SourcingPendingReviewCount,
    DateTime? SourcingNearestReviewDueAt,
    int WarrantiesEndingSoonCount,
    int WarrantyWithinDays,
    int OpenReplacementSlotsCount,
    string CurrencyCode);

/// <param name="WarrantyWithinDays">How far ahead "ending soon" looks; a display window, not a business rule.</param>
public sealed record GetClientDashboardSummaryQuery(Guid ClientUserId, int WarrantyWithinDays = 7) : IRequest<ClientDashboardSummaryDto>;

public sealed class GetClientDashboardSummaryQueryHandler : IRequestHandler<GetClientDashboardSummaryQuery, ClientDashboardSummaryDto>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;

    public GetClientDashboardSummaryQueryHandler(IFinanceRepository financeRepository, ICompanyUserRepository companyUserRepository)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
    }

    public async Task<ClientDashboardSummaryDto> Handle(GetClientDashboardSummaryQuery request, CancellationToken cancellationToken)
    {
        var member = await _companyUserRepository.GetByUserIdAsync(request.ClientUserId, cancellationToken);
        if (!CompanyMembershipPolicy.IsActive(member))
        {
            throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        }

        var withinDays = Math.Clamp(request.WarrantyWithinDays, 1, 90);
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var s = await _financeRepository.GetClientDashboardSnapshotAsync(member.CompanyId, today, today.AddDays(withinDays), cancellationToken);

        // A fee is overdue when BE marked it OVERDUE or its due date has passed while still unpaid.
        var owed = s.FeesOwedByClient;
        var overdue = owed.Where(f => f.Status == Domain.Constants.ServiceFeeStates.Overdue || f.DueDate < today).ToList();
        var nextDue = owed.Where(f => f.DueDate >= today).Select(f => (DateOnly?)f.DueDate).Min();

        return new ClientDashboardSummaryDto(
            PendingFeesAmount: owed.Sum(f => f.Amount),
            PendingFeesCount: owed.Count,
            OverdueFeesAmount: overdue.Sum(f => f.Amount),
            OverdueFeesCount: overdue.Count,
            NextFeeDueDate: nextDue,
            RefundsOwedAmount: s.RefundsOwedToClient.Sum(f => f.Amount),
            RefundsOwedCount: s.RefundsOwedToClient.Count,
            SourcingPendingReviewCount: s.SourcingPendingReviewDueAts.Count,
            SourcingNearestReviewDueAt: s.SourcingPendingReviewDueAts.Count == 0 ? null : s.SourcingPendingReviewDueAts.Min(),
            WarrantiesEndingSoonCount: s.WarrantiesEndingSoonCount,
            WarrantyWithinDays: withinDays,
            OpenReplacementSlotsCount: s.OpenReplacementSlotsCount,
            CurrencyCode: owed.Select(f => f.CurrencyCode).Concat(s.RefundsOwedToClient.Select(f => f.CurrencyCode)).FirstOrDefault() ?? "VND");
    }
}

/// <summary>Raw rows the dashboard summary is computed from (one company).</summary>
public sealed record ClientDashboardSnapshot(
    IReadOnlyList<ClientDashboardFee> FeesOwedByClient,
    IReadOnlyList<ClientDashboardFee> RefundsOwedToClient,
    IReadOnlyList<DateTime> SourcingPendingReviewDueAts,
    int WarrantiesEndingSoonCount,
    int OpenReplacementSlotsCount);

public sealed record ClientDashboardFee(decimal Amount, string Status, DateOnly DueDate, string CurrencyCode);
