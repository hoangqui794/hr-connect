using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Finance.Queries;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);

public sealed record ServiceFeeDto(
    Guid ServiceFeeId, Guid PlacementId, Guid CompanyId, string? CompanyName, string? JobTitle, string? CandidateName,
    decimal BaseSalary, decimal FeeMultiplier, decimal Amount, string CurrencyCode, DateOnly DueDate, string Status,
    DateTime? PaidAt, string? PaymentReference, DateTime CreatedAt);

public sealed record CommissionDto(
    Guid CommissionId, Guid PlacementId, Guid AttributionId, Guid AffiliateId, string? AffiliateName, string? JobTitle,
    string? CandidateName, decimal Amount, decimal? BaseAmount, string Status, string? MilestoneType,
    DateOnly? WarrantyEndDate, string? WarrantyStatus, string? ServiceFeeStatus, DateTime? ApprovedAt, DateTime CreatedAt);

public sealed record PayoutDto(
    Guid PayoutId, Guid CommissionId, decimal Amount, DateTime? PayoutDate, string? Method, string? TransactionReference,
    string Status, int AttemptNo, DateTime CreatedAt);

/// <summary>Viewer scope is resolved by the endpoint: Client sees one company; Admin sees all.</summary>
public sealed record GetServiceFeesQuery(Guid? CompanyUserId, string? Status, int Page, int PageSize) : IRequest<PagedResult<ServiceFeeDto>>;

/// <summary>AffiliateUserId limits the list to the affiliate's own commissions.</summary>
public sealed record GetCommissionsQuery(Guid? AffiliateUserId, string? Status, int Page, int PageSize) : IRequest<PagedResult<CommissionDto>>;

public sealed record GetPayoutsQuery(Guid? AffiliateUserId, int Page, int PageSize) : IRequest<PagedResult<PayoutDto>>;

public sealed class FinanceQueryHandlers :
    IRequestHandler<GetServiceFeesQuery, PagedResult<ServiceFeeDto>>,
    IRequestHandler<GetCommissionsQuery, PagedResult<CommissionDto>>,
    IRequestHandler<GetPayoutsQuery, PagedResult<PayoutDto>>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;

    public FinanceQueryHandlers(IFinanceRepository financeRepository, ICompanyUserRepository companyUserRepository)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
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

        var (items, total) = await _financeRepository.GetServiceFeesAsync(companyId, Upper(request.Status), page, pageSize, cancellationToken);
        return new PagedResult<ServiceFeeDto>(items.Select(fee => new ServiceFeeDto(
            fee.ServiceFeeId, fee.PlacementId, fee.CompanyId, fee.Company?.CompanyName,
            fee.Placement?.Application?.Job?.Title, fee.Placement?.Application?.Candidate?.FullName,
            fee.BaseSalary, fee.FeeMultiplier, fee.Amount, fee.CurrencyCode, fee.DueDate, fee.Status,
            fee.PaidAt, fee.PaymentReference, fee.CreatedAt)).ToList(), total, page, pageSize);
    }

    public async Task<PagedResult<CommissionDto>> Handle(GetCommissionsQuery request, CancellationToken cancellationToken)
    {
        var (page, pageSize) = Normalize(request.Page, request.PageSize);
        var (items, total) = await _financeRepository.GetCommissionsAsync(request.AffiliateUserId, Upper(request.Status), page, pageSize, cancellationToken);
        return new PagedResult<CommissionDto>(items.Select(c => new CommissionDto(
            c.CommissionId, c.PlacementId, c.AttributionId, c.Attribution.AffiliateId, c.Attribution.Affiliate?.DisplayName ?? c.Attribution.Affiliate?.User?.DisplayName,
            c.Placement?.Application?.Job?.Title, c.Placement?.Application?.Candidate?.FullName,
            c.Amount, c.BaseAmount, c.Status, c.MilestoneType,
            c.Placement?.Warranty?.EndDate, c.Placement?.Warranty?.Status, c.Placement?.ServiceFee?.Status,
            c.ApprovedAt, c.CreatedAt)).ToList(), total, page, pageSize);
    }

    public async Task<PagedResult<PayoutDto>> Handle(GetPayoutsQuery request, CancellationToken cancellationToken)
    {
        var (page, pageSize) = Normalize(request.Page, request.PageSize);
        var (items, total) = await _financeRepository.GetPayoutsAsync(request.AffiliateUserId, page, pageSize, cancellationToken);
        return new PagedResult<PayoutDto>(items.Select(p => new PayoutDto(
            p.PayoutId, p.CommissionId, p.Amount, p.PayoutDate, p.Method, p.TransactionReference,
            p.Status, p.AttemptNo, p.CreatedAt)).ToList(), total, page, pageSize);
    }

    private static (int Page, int PageSize) Normalize(int page, int pageSize) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, 100));

    private static string? Upper(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
