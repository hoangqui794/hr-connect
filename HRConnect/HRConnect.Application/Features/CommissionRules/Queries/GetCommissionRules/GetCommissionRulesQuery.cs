using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CommissionRules.Queries.GetCommissionRules;

public sealed record GetCommissionRulesQuery(
    Guid? ServiceTypeId,
    string? MilestoneType,
    bool? IsActive,
    int Page,
    int PageSize) : IRequest<GetCommissionRulesResponse>;

public sealed record CommissionRuleListItemDto(
    Guid CommissionRuleId,
    Guid ServiceTypeId,
    string ServiceTypeCode,
    string ServiceTypeName,
    string Name,
    string MilestoneType,
    string? MilestoneName,
    string RateType,
    decimal RateValue,
    bool WarrantyRequired,
    DateTime? EffectiveFrom,
    DateTime? EffectiveTo,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record GetCommissionRulesData(
    IReadOnlyList<CommissionRuleListItemDto> Items,
    int Page,
    int PageSize,
    int Total,
    int TotalPages);

public sealed record GetCommissionRulesResponse(
    bool Success,
    string Message,
    GetCommissionRulesData Data);

public sealed class GetCommissionRulesQueryHandler
    : IRequestHandler<GetCommissionRulesQuery, GetCommissionRulesResponse>
{
    private readonly ICommissionRuleRepository _rules;

    public GetCommissionRulesQueryHandler(ICommissionRuleRepository rules) => _rules = rules;

    public async Task<GetCommissionRulesResponse> Handle(
        GetCommissionRulesQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var (items, total) = await _rules.GetListAsync(
            request.ServiceTypeId,
            request.MilestoneType,
            request.IsActive,
            page,
            pageSize,
            cancellationToken);

        var data = items.Select(rule => new CommissionRuleListItemDto(
            rule.CommissionRuleId,
            rule.ServiceTypeId,
            rule.ServiceType.Code,
            rule.ServiceType.Name,
            rule.Name,
            rule.MilestoneType ?? string.Empty,
            rule.MilestoneTypeNavigation?.Name,
            rule.RateType ?? string.Empty,
            rule.RateValue ?? 0,
            rule.WarrantyRequired,
            rule.EffectiveFrom,
            rule.EffectiveTo,
            rule.IsActive,
            rule.CreatedAt,
            rule.UpdatedAt)).ToList();

        return new(
            true,
            "Lay danh sach quy tac hoa hong thanh cong.",
            new(data, page, pageSize, total, (int)Math.Ceiling(total / (double)pageSize)));
    }
}
