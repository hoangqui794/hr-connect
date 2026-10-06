using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CommissionRules.Queries.GetCommissionRuleDetail;

public sealed record GetCommissionRuleDetailQuery(Guid CommissionRuleId)
    : IRequest<GetCommissionRuleDetailResponse>;

public sealed record CommissionRuleDetailDto(
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

public sealed record GetCommissionRuleDetailResponse(
    bool Success,
    string Message,
    CommissionRuleDetailDto Data);

public sealed class GetCommissionRuleDetailQueryHandler
    : IRequestHandler<GetCommissionRuleDetailQuery, GetCommissionRuleDetailResponse>
{
    private readonly ICommissionRuleRepository _rules;

    public GetCommissionRuleDetailQueryHandler(ICommissionRuleRepository rules) => _rules = rules;

    public async Task<GetCommissionRuleDetailResponse> Handle(
        GetCommissionRuleDetailQuery request,
        CancellationToken cancellationToken)
    {
        var rule = await _rules.GetByIdAsync(request.CommissionRuleId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy quy tắc hoa hồng.");

        return new(
            true,
            "Lấy chi tiết quy tắc hoa hồng thành công.",
            new(
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
                rule.UpdatedAt));
    }
}
