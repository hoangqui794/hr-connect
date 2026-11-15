using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Placements.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Finance.Queries;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);

/// <summary>
/// Kind PLACEMENT (HEADHUNT_COD) has a placement and candidate; DEPOSIT, SETTLEMENT and CREDIT
/// (CV_SOURCING) have only a job. CREDIT is owed to the Client.
/// </summary>
public sealed record ServiceFeeDto(
    Guid ServiceFeeId, Guid? PlacementId, Guid CompanyId, string? CompanyName, string? JobTitle, string? CandidateName,
    decimal BaseSalary, decimal FeeMultiplier, decimal Amount, string CurrencyCode, DateOnly DueDate, string Status,
    DateTime? PaidAt, string? PaymentReference, DateTime CreatedAt, string Kind = "PLACEMENT", Guid? JobId = null,
    string? ReconciliationStatus = null, int? SourcingTarget = null, decimal? SourcingPricePerCv = null,
    DateTime? ReplacementExpiredAt = null, int? SourcingCounted = null,
    string? ServiceTypeCode = null, int? DaysOverdue = null, DateTime? PaymentSubmittedAt = null,
    bool PendingOnlinePayment = false, DateOnly? PlacementStartDate = null);

public sealed record ServiceFeeSummaryBucket(string Kind, string Status, string CurrencyCode, int Count, decimal Amount);

public sealed record ServiceFeeCurrencySummaryDto(
    string CurrencyCode,
    decimal UnpaidAmount,
    int UnpaidCount,
    decimal OverdueAmount,
    int OverdueCount,
    decimal PaidAmount,
    int PaidCount,
    decimal PendingRefundAmount,
    int PendingRefundCount,
    decimal PaidRefundAmount,
    int PaidRefundCount);

public sealed record ServiceFeeSummaryDto(
    decimal UnpaidAmount,
    int UnpaidCount,
    decimal OverdueAmount,
    int OverdueCount,
    decimal PaidAmount,
    int PaidCount,
    decimal PendingRefundAmount,
    int PendingRefundCount,
    decimal PaidRefundAmount,
    int PaidRefundCount,
    int TotalCount,
    string CurrencyCode,
    IReadOnlyList<ServiceFeeCurrencySummaryDto>? CurrencyBreakdowns = null);

/// <summary>PlacementId is set for HEADHUNT_COD; SourcingDeliveryId for CV_SOURCING (one per accepted CV).</summary>
public sealed record CommissionDto(
    Guid CommissionId, Guid? PlacementId, Guid AttributionId, Guid AffiliateId, string? AffiliateName, string? JobTitle,
    string? CandidateName, decimal Amount, decimal? BaseAmount, string Status, string? MilestoneType,
    DateOnly? WarrantyEndDate, string? WarrantyStatus, string? ServiceFeeStatus, DateTime? ApprovedAt, DateTime CreatedAt,
    AffiliateBankDto? AffiliateBank = null, Guid? SourcingDeliveryId = null, Guid? JobId = null,
    Guid? ReplacementSlotId = null, string? ReplacementSlotStatus = null, DateTime? ReplacementExpiresAt = null);

/// <summary>Where to transfer the commission. Only returned to users who record payouts.</summary>
public sealed record AffiliateBankDto(string? BankName, string? BankAccountNumber, string? BankAccountHolder, string? BankBranch);

public sealed record WarrantyDto(
    Guid WarrantyId, Guid PlacementId, string? CompanyName, string? JobTitle, string? CandidateName, string? Position,
    DateOnly StartDate, DateOnly? EndDate, string Status, string PlacementStatus, string? ResultNote,
    string? ServiceFeeStatus, decimal? ServiceFeeAmount, string? CommissionStatus, decimal? CommissionAmount,
    Guid? JobId = null, int? DaysRemaining = null, DateTime? ClaimReportedAt = null, DateOnly? LastWorkingDate = null,
    string? ResignationReason = null, Guid? ReplacementSlotId = null, string? ReplacementSlotStatus = null,
    DateTime? ReplacementExpiresAt = null, DateOnly? ServiceFeeDueDate = null);

public sealed record PayoutDto(
    Guid PayoutId, Guid CommissionId, decimal Amount, DateTime? PayoutDate, string? Method, string? TransactionReference,
    string Status, int AttemptNo, DateTime CreatedAt,
    string? AffiliateName = null, string? CandidateName = null, string? JobTitle = null);

/// <summary>Viewer scope is resolved by the endpoint: Client sees one company; Admin sees all.</summary>
public sealed record GetServiceFeesQuery(Guid? CompanyUserId, string? Status, int Page, int PageSize, Guid? JobId = null, string? Kind = null)
    : IRequest<PagedResult<ServiceFeeDto>>;

/// <summary>Full service-fee KPI totals across all records (not truncated by pageSize).</summary>
public sealed record GetServiceFeesSummaryQuery(Guid? CompanyUserId, Guid? CompanyId = null, Guid? JobId = null)
    : IRequest<ServiceFeeSummaryDto>;

/// <summary>AffiliateUserId limits the list to the affiliate's own commissions.</summary>
public sealed record GetCommissionsQuery(Guid? AffiliateUserId, string? Status, int Page, int PageSize, bool IncludeBankDetails = false)
    : IRequest<PagedResult<CommissionDto>>;

/// <summary>CompanyUserId limits the list to that Client's company; null lists every warranty.</summary>
public sealed record GetWarrantiesQuery(Guid? CompanyUserId, string? Status, int Page, int PageSize) : IRequest<PagedResult<WarrantyDto>>;

public sealed record GetPayoutsQuery(Guid? AffiliateUserId, int Page, int PageSize) : IRequest<PagedResult<PayoutDto>>;

public sealed class FinanceQueryHandlers :
    IRequestHandler<GetServiceFeesQuery, PagedResult<ServiceFeeDto>>,
    IRequestHandler<GetServiceFeesSummaryQuery, ServiceFeeSummaryDto>,
    IRequestHandler<GetCommissionsQuery, PagedResult<CommissionDto>>,
    IRequestHandler<GetPayoutsQuery, PagedResult<PayoutDto>>,
    IRequestHandler<GetWarrantiesQuery, PagedResult<WarrantyDto>>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ISourcingDeliveryRepository? _sourcingDeliveries;
    private readonly IOnlinePaymentRepository? _onlinePayments;
    private readonly IVnPayGateway? _vnPayGateway;

    public FinanceQueryHandlers(
        IFinanceRepository financeRepository,
        ICompanyUserRepository companyUserRepository,
        ISourcingDeliveryRepository? sourcingDeliveries = null,
        IOnlinePaymentRepository? onlinePayments = null,
        IVnPayGateway? vnPayGateway = null)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
        _sourcingDeliveries = sourcingDeliveries;
        _onlinePayments = onlinePayments;
        _vnPayGateway = vnPayGateway;
    }

    public async Task<PagedResult<ServiceFeeDto>> Handle(GetServiceFeesQuery request, CancellationToken cancellationToken)
    {
        var (page, pageSize) = Normalize(request.Page, request.PageSize);
        Guid? companyId = null;
        if (request.CompanyUserId is Guid companyUserId)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(companyUserId, cancellationToken)
                ?? throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            companyId = companyUser.CompanyId;
        }

        var (items, total) = await _financeRepository.GetServiceFeesAsync(
            companyId, Upper(request.Status), page, pageSize, cancellationToken, request.JobId, Upper(request.Kind));

        // A replacement refund stores no placement, so it is matched back to the expired slot it came from
        // (same job, refund base = the fee the slot was opened for) to show who left and when the slot ran out.
        var refundJobIds = items
            .Where(fee => fee.Kind == ServiceFeeKinds.ReplacementRefund && fee.JobId.HasValue)
            .Select(fee => fee.JobId!.Value).Distinct().ToList();
        var expiredSlots = refundJobIds.Count == 0
            ? Array.Empty<ReplacementSlot>()
            : await _financeRepository.GetExpiredReplacementSlotsForJobsAsync(refundJobIds, cancellationToken) ?? Array.Empty<ReplacementSlot>();
        ReplacementSlot? SlotOf(ServiceFee fee) => fee.Kind != ServiceFeeKinds.ReplacementRefund ? null : expiredSlots
            .Where(slot => slot.JobId == fee.JobId && slot.ServiceFee?.Amount == fee.BaseSalary)
            .OrderBy(slot => Math.Abs(((slot.ClosedAt ?? slot.UpdatedAt) - fee.CreatedAt).Ticks))
            .FirstOrDefault();

        var sourcingJobIds = items
            .Where(fee => fee.JobId.HasValue &&
                (fee.Kind == ServiceFeeKinds.Deposit ||
                 fee.Kind == ServiceFeeKinds.Settlement ||
                 fee.Kind == ServiceFeeKinds.Credit ||
                 fee.Job?.SourcingTarget > 0))
            .Select(fee => fee.JobId!.Value)
            .Distinct()
            .ToHashSet();
        var countedByJob = sourcingJobIds.Count == 0 || _sourcingDeliveries is null
            ? null
            : await _sourcingDeliveries.GetCountedCountsByJobIdsAsync(sourcingJobIds, cancellationToken);

        var openPayableFeeIds = items
            .Where(fee => !ServiceFeeKinds.OwedToClient.Contains(fee.Kind)
                && fee.Status is ServiceFeeStates.Pending or ServiceFeeStates.Due or ServiceFeeStates.Overdue)
            .Select(fee => fee.ServiceFeeId)
            .ToList();
        var pendingOnlineStatuses = openPayableFeeIds.Count == 0 || _onlinePayments is null
            ? new Dictionary<Guid, string>()
            : await _onlinePayments.GetActiveStatusesByTargetIdsAsync(
                OnlinePaymentTargets.ServiceFee,
                openPayableFeeIds,
                DateTime.UtcNow.Subtract(_vnPayGateway?.PaymentLifetime ?? TimeSpan.FromMinutes(15)),
                cancellationToken);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return new PagedResult<ServiceFeeDto>(items.Select(fee =>
        {
            var resolvedServiceTypeCode = fee.Kind switch
            {
                ServiceFeeKinds.Placement or ServiceFeeKinds.ReplacementRefund => "HEADHUNT_COD",
                ServiceFeeKinds.Deposit or ServiceFeeKinds.Settlement or ServiceFeeKinds.Credit => "CV_SOURCING",
                _ => fee.Job?.ServiceType?.Code ?? fee.Placement?.Application?.Job?.ServiceType?.Code,
            };
            int? daysOverdue = fee.Status == ServiceFeeStates.Overdue && !ServiceFeeKinds.OwedToClient.Contains(fee.Kind)
                ? Math.Max(0, today.DayNumber - fee.DueDate.DayNumber)
                : null;
            DateTime? paymentSubmittedAt = fee.Kind == ServiceFeeKinds.Deposit
                && fee.Status != ServiceFeeStates.Paid
                && fee.Status != ServiceFeeStates.Cancelled
                    ? fee.Job?.DepositSubmittedAt
                    : null;
            var pendingOnline = pendingOnlineStatuses.ContainsKey(fee.ServiceFeeId);

            return new ServiceFeeDto(
                fee.ServiceFeeId, fee.PlacementId, fee.CompanyId, fee.Company?.CompanyName,
                fee.Job?.Title ?? fee.Placement?.Application?.Job?.Title,
                fee.Placement?.Application?.Candidate?.FullName ?? SlotOf(fee)?.OriginalPlacement?.Application?.Candidate?.FullName,
                fee.BaseSalary, fee.FeeMultiplier, fee.Amount, fee.CurrencyCode, fee.DueDate, fee.Status,
                fee.PaidAt, fee.PaymentReference, fee.CreatedAt, fee.Kind,
                fee.JobId ?? fee.Placement?.Application?.JobId,
                fee.Placement?.Reconciliation?.Status,
                // CV_SOURCING: lets the Client see how a deposit or settlement was worked out (CVs × price per CV).
                fee.Job?.SourcingTarget, fee.Job?.SourcingPricePerCv,
                SlotOf(fee)?.ExpiresAt,
                fee.JobId is { } sJobId && countedByJob is not null && sourcingJobIds.Contains(sJobId)
                    ? countedByJob.GetValueOrDefault(sJobId, 0)
                    : null,
                resolvedServiceTypeCode,
                daysOverdue,
                paymentSubmittedAt,
                pendingOnline,
                fee.Placement?.ActualStartDate);
        }).ToList(), total, page, pageSize);
    }

    public async Task<ServiceFeeSummaryDto> Handle(GetServiceFeesSummaryQuery request, CancellationToken cancellationToken)
    {
        Guid? companyId = request.CompanyId;
        if (request.CompanyUserId is Guid companyUserId)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(companyUserId, cancellationToken);
            if (!CompanyMembershipPolicy.IsActive(member))
            {
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            companyId = member.CompanyId;
        }

        var buckets = await _financeRepository.GetServiceFeeSummaryBucketsAsync(companyId, request.JobId, cancellationToken)
            ?? Array.Empty<ServiceFeeSummaryBucket>();

        var breakdowns = buckets
            .GroupBy(b => string.IsNullOrWhiteSpace(b.CurrencyCode) ? "VND" : b.CurrencyCode)
            .OrderByDescending(g => string.Equals(g.Key, "VND", StringComparison.OrdinalIgnoreCase))
            .ThenBy(g => g.Key)
            .Select(g =>
            {
                var owedByClient = g.Where(b => !ServiceFeeKinds.OwedToClient.Contains(b.Kind)).ToList();
                var owedToClient = g.Where(b => ServiceFeeKinds.OwedToClient.Contains(b.Kind)).ToList();

                var unpaid = owedByClient.Where(b => b.Status is ServiceFeeStates.Pending or ServiceFeeStates.Due or ServiceFeeStates.Overdue).ToList();
                var overdue = owedByClient.Where(b => b.Status == ServiceFeeStates.Overdue).ToList();
                var paid = owedByClient.Where(b => b.Status == ServiceFeeStates.Paid).ToList();
                var pendingRefund = owedToClient.Where(b => b.Status is ServiceFeeStates.Pending or ServiceFeeStates.Due or ServiceFeeStates.Overdue).ToList();
                var paidRefund = owedToClient.Where(b => b.Status == ServiceFeeStates.Paid).ToList();

                return new ServiceFeeCurrencySummaryDto(
                    g.Key,
                    unpaid.Sum(x => x.Amount),
                    unpaid.Sum(x => x.Count),
                    overdue.Sum(x => x.Amount),
                    overdue.Sum(x => x.Count),
                    paid.Sum(x => x.Amount),
                    paid.Sum(x => x.Count),
                    pendingRefund.Sum(x => x.Amount),
                    pendingRefund.Sum(x => x.Count),
                    paidRefund.Sum(x => x.Amount),
                    paidRefund.Sum(x => x.Count));
            })
            .ToList();

        var primary = breakdowns.FirstOrDefault() ?? new ServiceFeeCurrencySummaryDto("VND", 0m, 0, 0m, 0, 0m, 0, 0m, 0, 0m, 0);
        return new ServiceFeeSummaryDto(
            primary.UnpaidAmount,
            primary.UnpaidCount,
            primary.OverdueAmount,
            primary.OverdueCount,
            primary.PaidAmount,
            primary.PaidCount,
            primary.PendingRefundAmount,
            primary.PendingRefundCount,
            primary.PaidRefundAmount,
            primary.PaidRefundCount,
            buckets.Sum(b => b.Count),
            primary.CurrencyCode,
            breakdowns);
    }

    public async Task<PagedResult<CommissionDto>> Handle(GetCommissionsQuery request, CancellationToken cancellationToken)
    {
        var (page, pageSize) = Normalize(request.Page, request.PageSize);
        var (items, total) = await _financeRepository.GetCommissionsAsync(request.AffiliateUserId, Upper(request.Status), page, pageSize, cancellationToken);
        // CV_SOURCING commissions link to a job's Deposit/Settlement/Credit fees instead of a single Placement.ServiceFee.
        var sourcingJobIds = items
            .Where(c => c.PlacementId == null && c.SourcingDelivery != null)
            .Select(c => c.SourcingDelivery!.JobId)
            .Distinct()
            .ToList();
        var sourcingFeeStatusByJob = sourcingJobIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await _financeRepository.GetJobServiceFeesAsync(sourcingJobIds, cancellationToken))
                .Where(f => f.JobId.HasValue)
                .GroupBy(f => f.JobId!.Value)
                .ToDictionary(g => g.Key, g => ResolveSourcingFeeStatus(g));
        var placementIds = items
            .Where(c => c.PlacementId.HasValue)
            .Select(c => c.PlacementId!.Value)
            .Distinct()
            .ToList();
        var replacementSlotsByPlacement = placementIds.Count == 0
            ? new Dictionary<Guid, Domain.Entities.ReplacementSlot>()
            : (await _financeRepository.GetReplacementSlotsByOriginalPlacementIdsAsync(placementIds, cancellationToken))
                .GroupBy(slot => slot.OriginalPlacementId)
                .ToDictionary(g => g.Key, g => g.First());

        // An Affiliate sees its own commission but never the Client's fee: BaseAmount is the service fee
        // (percent rules) or the Client's price per CV (CV_SOURCING), so it is only returned to platform roles.
        var hideClientFee = request.AffiliateUserId.HasValue;
        return new PagedResult<CommissionDto>(items.Select(c =>
        {
            var slot = c.PlacementId.HasValue ? replacementSlotsByPlacement.GetValueOrDefault(c.PlacementId.Value) : null;
            return new CommissionDto(
                c.CommissionId, c.PlacementId, c.AttributionId, c.Attribution.AffiliateId, c.Attribution.Affiliate?.DisplayName ?? c.Attribution.Affiliate?.User?.DisplayName,
                c.Placement?.Application?.Job?.Title ?? c.SourcingDelivery?.Job?.Title,
                c.Placement?.Application?.Candidate?.FullName ?? c.SourcingDelivery?.Application?.Candidate?.FullName,
                c.Amount, hideClientFee ? null : c.BaseAmount, c.Status, c.MilestoneType,
                c.Placement?.Warranty?.EndDate, c.Placement?.Warranty?.Status,
                c.Placement?.GetEffectiveServiceFee()?.Status ?? (c.SourcingDelivery?.JobId is { } sJobId ? sourcingFeeStatusByJob.GetValueOrDefault(sJobId, ServiceFeeStates.Pending) : null),
                c.ApprovedAt, c.CreatedAt,
                request.IncludeBankDetails && c.Attribution.Affiliate is { } affiliate
                    ? new AffiliateBankDto(affiliate.BankName, affiliate.BankAccountNumber, affiliate.BankAccountHolder, affiliate.BankBranch)
                    : null,
                c.SourcingDeliveryId,
                // Lets the Affiliate refer a replacement to the same job when the warranty was voided.
                c.Placement?.Application?.JobId ?? c.SourcingDelivery?.JobId,
                slot?.ReplacementSlotId,
                slot?.Status,
                slot?.ExpiresAt);
        }).ToList(), total, page, pageSize);
    }

    private static string ResolveSourcingFeeStatus(IEnumerable<ServiceFee> fees)
    {
        var list = fees as IReadOnlyCollection<ServiceFee> ?? fees.ToList();
        if (list.Any(f => f.Kind is ServiceFeeKinds.Deposit or ServiceFeeKinds.Settlement && f.Status == ServiceFeeStates.Overdue))
        {
            return ServiceFeeStates.Overdue;
        }

        var hasClosing = list.Any(f => ServiceFeeKinds.Closing.Contains(f.Kind));
        var allCollectiblesPaid = list
            .Where(f => f.Kind is ServiceFeeKinds.Deposit or ServiceFeeKinds.Settlement)
            .All(f => f.Status == ServiceFeeStates.Paid);
        return hasClosing && allCollectiblesPaid ? ServiceFeeStates.Paid : ServiceFeeStates.Pending;
    }

    public async Task<PagedResult<PayoutDto>> Handle(GetPayoutsQuery request, CancellationToken cancellationToken)
    {
        var (page, pageSize) = Normalize(request.Page, request.PageSize);
        var (items, total) = await _financeRepository.GetPayoutsAsync(request.AffiliateUserId, page, pageSize, cancellationToken);
        return new PagedResult<PayoutDto>(items.Select(p => new PayoutDto(
            p.PayoutId, p.CommissionId, p.Amount, p.PayoutDate, p.Method, p.TransactionReference,
            p.Status, p.AttemptNo, p.CreatedAt,
            // Who was paid for what, so the payout history reads without opening each commission.
            p.Commission?.Attribution?.Affiliate?.DisplayName ?? p.Commission?.Attribution?.Affiliate?.User?.DisplayName,
            p.Commission?.Placement?.Application?.Candidate?.FullName ?? p.Commission?.SourcingDelivery?.Application?.Candidate?.FullName,
            p.Commission?.Placement?.Application?.Job?.Title ?? p.Commission?.SourcingDelivery?.Job?.Title)).ToList(), total, page, pageSize);
    }

    public async Task<PagedResult<WarrantyDto>> Handle(GetWarrantiesQuery request, CancellationToken cancellationToken)
    {
        var (page, pageSize) = Normalize(request.Page, request.PageSize);
        Guid? companyId = null;
        if (request.CompanyUserId is Guid companyUserId)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(companyUserId, cancellationToken)
                ?? throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            companyId = companyUser.CompanyId;
        }

        var (items, total) = await _financeRepository.GetWarrantiesAsync(companyId, Upper(request.Status), page, pageSize, cancellationToken);
        // A Client sees its own service fee but never the Affiliate's commission.
        var hideCommission = companyId.HasValue;
        var placementIds = items.Select(w => w.PlacementId).Distinct().ToList();
        var replacementSlotsByPlacement = placementIds.Count == 0
            ? new Dictionary<Guid, Domain.Entities.ReplacementSlot>()
            : (await _financeRepository.GetReplacementSlotsByOriginalPlacementIdsAsync(placementIds, cancellationToken))
                .GroupBy(slot => slot.OriginalPlacementId)
                .ToDictionary(g => g.Key, g => g.First());
        var claimWarrantyIds = items
            .Where(w => w.Status is WarrantyStates.Claimed or WarrantyStates.Voided)
            .Select(w => w.WarrantyId)
            .Distinct()
            .ToList();
        var reportedClaimTimeByWarranty = claimWarrantyIds.Count == 0
            ? new Dictionary<Guid, DateTime>()
            : (await _financeRepository.GetWarrantyClaimAuditLogsAsync(claimWarrantyIds, cancellationToken))
                .Where(log => log.EntityId.HasValue && log.Action == AuditActions.WarrantyClaimReported)
                .GroupBy(log => log.EntityId!.Value)
                .ToDictionary(g => g.Key, g => g.Max(log => log.CreatedAt));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return new PagedResult<WarrantyDto>(items.Select(w =>
        {
            var commission = hideCommission ? null : w.Placement?.Commissions.OrderByDescending(c => c.CreatedAt).FirstOrDefault();
            var slot = replacementSlotsByPlacement.GetValueOrDefault(w.PlacementId);
            var (lastWorkingDate, resignationReason, _) = w.Placement is null
                ? PlacementResignationParser.Extract(null, w)
                : PlacementResignationParser.Extract(w.Placement, w);
            DateTime? claimReportedAt = reportedClaimTimeByWarranty.TryGetValue(w.WarrantyId, out var loggedAt)
                ? loggedAt
                : (w.Status == WarrantyStates.Claimed ? w.UpdatedAt : null);
            int? daysRemaining = w.EndDate is DateOnly end && w.Status is WarrantyStates.Active or WarrantyStates.Claimed
                ? Math.Max(0, end.DayNumber - today.DayNumber)
                : null;

            return new WarrantyDto(
                w.WarrantyId, w.PlacementId, w.Placement?.Application?.Job?.Company?.CompanyName,
                w.Placement?.Application?.Job?.Title, w.Placement?.Application?.Candidate?.FullName, w.Placement?.Position,
                w.StartDate, w.EndDate, w.Status, w.Placement?.Status ?? string.Empty, w.ResultNote,
                w.Placement?.GetEffectiveServiceFee()?.Status, w.Placement?.ServiceFee?.Amount, commission?.Status, commission?.Amount,
                w.Placement?.Application?.JobId,
                daysRemaining,
                claimReportedAt,
                lastWorkingDate,
                resignationReason,
                slot?.ReplacementSlotId,
                slot?.Status,
                slot?.ExpiresAt,
                w.Placement?.ServiceFee?.DueDate);
        }).ToList(), total, page, pageSize);
    }

    private static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));

    private static string? Upper(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
