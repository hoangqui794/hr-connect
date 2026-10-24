using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Placements.Queries.GetPlacementReconciliations;

public sealed class GetPlacementReconciliationsQueryHandler
    : IRequestHandler<GetPlacementReconciliationsQuery, GetPlacementReconciliationsResponse>
{
    private readonly IPlacementReconciliationRepository _repository;

    public GetPlacementReconciliationsQueryHandler(IPlacementReconciliationRepository repository) => _repository = repository;

    public async Task<GetPlacementReconciliationsResponse> Handle(GetPlacementReconciliationsQuery request, CancellationToken cancellationToken)
    {
        if (request.Page < 1 || request.PageSize is < 1 or > 100)
            throw new BadRequestException("Thông tin phân trang không hợp lệ.");

        var status = request.Status?.Trim().ToUpperInvariant();
        if (status is not null && status is not ("PENDING" or "CONFIRMED" or "FLAGGED"))
            throw new BadRequestException("Trạng thái đối soát không hợp lệ.");

        var (items, totalCount) = await _repository.GetPageAsync(status, request.Page, request.PageSize, cancellationToken);
        return new GetPlacementReconciliationsResponse(
            items.Select(item => new PlacementReconciliationListItem(
                item.ReconciliationId,
                item.ApplicationId,
                item.PlacementId,
                item.Application.Job.Title,
                item.Application.Job.Company.CompanyName,
                item.Application.Candidate.FullName,
                MaskEmail(item.Application.Candidate.Email),
                item.Application.Attribution?.Affiliate?.User?.DisplayName,
                item.ClaimedOutcome,
                item.Placement?.ActualStartDate,
                item.Placement?.ServiceFee?.Amount,
                item.Placement?.ServiceFee?.CurrencyCode,
                item.Status,
                item.ContactChannel,
                item.Note,
                item.ResolutionNote,
                item.ResolutionAction,
                item.ConcurrencyToken,
                item.CreatedAt,
                item.ReviewedAt)).ToList(),
            totalCount,
            request.Page,
            request.PageSize);
    }

    private static string? MaskEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;
        var separator = email.IndexOf('@');
        if (separator <= 0) return "***";
        var local = email[..separator];
        var visible = local[..Math.Min(2, local.Length)];
        return $"{visible}***{email[separator..]}";
    }
}
