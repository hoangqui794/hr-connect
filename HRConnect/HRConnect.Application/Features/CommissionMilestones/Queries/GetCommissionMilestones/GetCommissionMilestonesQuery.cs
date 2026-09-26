using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CommissionMilestones.Queries.GetCommissionMilestones;

public sealed record GetCommissionMilestonesQuery(bool? IsActive)
    : IRequest<GetCommissionMilestonesResponse>;

public sealed record CommissionMilestoneDto(
    string Code,
    string Name,
    string? Description,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record GetCommissionMilestonesResponse(
    bool Success,
    string Message,
    IReadOnlyList<CommissionMilestoneDto> Data);

public sealed class GetCommissionMilestonesQueryHandler
    : IRequestHandler<GetCommissionMilestonesQuery, GetCommissionMilestonesResponse>
{
    private readonly ICommissionMilestoneRepository _milestones;

    public GetCommissionMilestonesQueryHandler(ICommissionMilestoneRepository milestones) => _milestones = milestones;

    public async Task<GetCommissionMilestonesResponse> Handle(
        GetCommissionMilestonesQuery request,
        CancellationToken cancellationToken)
    {
        var milestones = await _milestones.GetListAsync(request.IsActive, cancellationToken);
        var data = milestones.Select(milestone => new CommissionMilestoneDto(
            milestone.MilestoneCode,
            milestone.Name,
            milestone.Description,
            milestone.IsActive,
            milestone.CreatedAt,
            milestone.UpdatedAt)).ToList();

        return new(true, "Lay danh sach commission milestones thanh cong.", data);
    }
}
