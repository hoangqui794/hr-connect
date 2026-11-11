using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Offers.Queries.GetOfferAcceptanceImpact;

public sealed class GetOfferAcceptanceImpactQueryHandler
    : IRequestHandler<GetOfferAcceptanceImpactQuery, GetOfferAcceptanceImpactResponse>
{
    private readonly IOfferRepository _offers;
    private readonly IPlacementRepository _placements;

    public GetOfferAcceptanceImpactQueryHandler(
        IOfferRepository offers,
        IPlacementRepository placements)
    {
        _offers = offers;
        _placements = placements;
    }

    public async Task<GetOfferAcceptanceImpactResponse> Handle(
        GetOfferAcceptanceImpactQuery request,
        CancellationToken cancellationToken)
    {
        var target = await _offers.GetByIdWithApplicationAsync(request.OfferId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy lời mời nhận việc.");

        if (target.Application?.Candidate?.UserId != request.CurrentUserId)
        {
            throw new ForbiddenException("Chỉ ứng viên sở hữu lời mời nhận việc này mới có quyền xem ảnh hưởng khi chấp nhận.");
        }

        if (!string.Equals(target.Status, OfferStates.Sent, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException($"Chỉ có thể kiểm tra offer đang ở trạng thái SENT. Trạng thái hiện tại: {target.Status}.");
        }

        var employmentType = target.Application.Job?.EmploymentType?.Trim().ToUpperInvariant() ?? string.Empty;
        var isFullTime = OfferAcceptancePolicy.IsFullTime(employmentType);
        var otherOffers = isFullTime
            ? await _offers.GetCandidateOffersForAcceptanceAsync(
                target.Application.CandidateId,
                target.OfferId,
                cancellationToken)
            : Array.Empty<Offer>();

        var acceptedFullTime = otherOffers
            .Where(IsFullTimeOffer)
            .FirstOrDefault(o => string.Equals(o.Status, OfferStates.Accepted, StringComparison.OrdinalIgnoreCase));

        var pendingFullTime = otherOffers
            .Where(IsFullTimeOffer)
            .Where(o => string.Equals(o.Status, OfferStates.Sent, StringComparison.OrdinalIgnoreCase))
            .Select(ToItem)
            .ToList();

        var activePlacement = isFullTime
            ? await _placements.GetActiveFullTimeForCandidateAsync(
                target.Application.CandidateId,
                target.ApplicationId,
                cancellationToken)
            : null;

        var allowedActions = new List<string> { OfferAcceptanceActions.KeepOtherPendingOffers };
        if (isFullTime && pendingFullTime.Count > 0)
        {
            allowedActions.Add(OfferAcceptanceActions.WithdrawOtherPendingFullTimeOffers);
        }
        if (isFullTime && acceptedFullTime != null && activePlacement == null)
        {
            allowedActions.Add(OfferAcceptanceActions.ReplaceAcceptedFullTimeOffer);
        }
        if (isFullTime && activePlacement != null)
        {
            allowedActions.Add(OfferAcceptanceActions.TransitionFromActivePlacement);
        }

        return new GetOfferAcceptanceImpactResponse(
            target.OfferId,
            employmentType,
            isFullTime,
            acceptedFullTime == null ? null : ToItem(acceptedFullTime),
            pendingFullTime,
            activePlacement == null ? null : ToPlacementItem(activePlacement),
            allowedActions);
    }

    private static bool IsFullTimeOffer(Offer offer) =>
        OfferAcceptancePolicy.IsFullTime(offer.Application?.Job?.EmploymentType);

    private static OfferAcceptanceImpactItem ToItem(Offer offer) => new(
        offer.OfferId,
        offer.ApplicationId,
        offer.Application?.Job?.Title ?? string.Empty,
        offer.Application?.Job?.Company?.CompanyName ?? string.Empty,
        offer.Application?.Job?.EmploymentType ?? string.Empty,
        offer.Status,
        offer.Application?.PlannedStartDate ?? offer.StartDate);

    private static OfferAcceptanceImpactItem ToPlacementItem(Placement placement) => new(
        placement.OfferId,
        placement.ApplicationId,
        placement.Application?.Job?.Title ?? string.Empty,
        placement.Application?.Job?.Company?.CompanyName ?? string.Empty,
        placement.Application?.Job?.EmploymentType ?? string.Empty,
        placement.Status,
        placement.ActualStartDate);
}
