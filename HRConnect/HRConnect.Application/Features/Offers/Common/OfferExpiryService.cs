using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Offers.Common;

public sealed class OfferExpiryService : IOfferExpiryService
{
    internal const string NotificationType = "OFFER";
    internal const string ServiceName = "OFFER_EXPIRY_WORKER";

    private readonly IOfferRepository _offers;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public OfferExpiryService(
        IOfferRepository offers,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _offers = offers;
        _notifications = notifications;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<bool> ExpireAsync(Offer offer, DateTime now, CancellationToken cancellationToken = default)
    {
        var today = DateOnly.FromDateTime(now);
        if (offer.Status != OfferStates.Sent || !offer.ExpiryDate.HasValue || offer.ExpiryDate.Value >= today)
        {
            return false;
        }

        var previousStatus = offer.Status;
        offer.Status = OfferStates.Expired;
        offer.UpdatedAt = now;
        offer.ConcurrencyToken = Guid.NewGuid();
        _offers.Update(offer);

        var candidateUserId = offer.Application?.Candidate?.UserId;
        if (candidateUserId.HasValue)
        {
            var notificationExists = await _notifications.ExistsAsync(
                candidateUserId.Value,
                NotificationType,
                "OFFER",
                offer.OfferId,
                cancellationToken);
            if (!notificationExists)
            {
                await _notifications.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = candidateUserId.Value,
                    NotificationType = NotificationType,
                    Title = "Offer đã hết hạn phản hồi",
                    Message = "Lời mời nhận việc của bạn đã hết hạn phản hồi.",
                    RelatedEntityType = "OFFER",
                    RelatedEntityId = offer.OfferId,
                    Metadata = JsonSerializer.Serialize(new
                    {
                        offerId = offer.OfferId,
                        offerVersion = offer.OfferVersion,
                        expiryDate = offer.ExpiryDate
                    }),
                    IsRead = false,
                    CreatedAt = now
                }, cancellationToken);
            }
        }

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.OfferExpired,
            EntityType = "OFFER",
            EntityId = offer.OfferId,
            ActorType = AuditActorTypes.Service,
            Source = AuditSources.BackgroundWorker,
            ServiceName = ServiceName,
            CorrelationId = offer.OfferId,
            OldValues = new { status = previousStatus },
            NewValues = new
            {
                applicationId = offer.ApplicationId,
                offerVersion = offer.OfferVersion,
                status = offer.Status,
                expiryDate = offer.ExpiryDate
            }
        }, cancellationToken);

        try
        {
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (ConflictException) when (offer.Status == OfferStates.Expired)
        {
            return false;
        }
    }
}
