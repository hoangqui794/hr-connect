using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Offers.Commands.RespondToOffer;

public class RespondToOfferCommandHandler : IRequestHandler<RespondToOfferCommand, RespondToOfferResponse>
{
    private readonly IOfferRepository _offerRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RespondToOfferCommandHandler> _logger;

    public RespondToOfferCommandHandler(
        IOfferRepository offerRepository,
        IApplicationRepository applicationRepository,
        IUnitOfWork unitOfWork,
        ILogger<RespondToOfferCommandHandler> logger)
    {
        _offerRepository = offerRepository;
        _applicationRepository = applicationRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<RespondToOfferResponse> Handle(RespondToOfferCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Response))
        {
            throw new BadRequestException("Phản hồi không được để trống. Phải là ACCEPTED hoặc DECLINED.");
        }

        var normalizedResponse = request.Response.Trim().ToUpperInvariant();
        if (normalizedResponse is not ("ACCEPTED" or "DECLINED"))
        {
            throw new BadRequestException($"Phản hồi '{request.Response}' không hợp lệ. Phải là ACCEPTED hoặc DECLINED.");
        }

        if (normalizedResponse == "DECLINED" && string.IsNullOrWhiteSpace(request.DeclineReason))
        {
            throw new BadRequestException("Vui lòng cung cấp lý do từ chối offer.");
        }

        var offer = await _offerRepository.GetByIdWithApplicationAsync(request.OfferId, cancellationToken);
        if (offer == null)
        {
            _logger.LogWarning("Không tìm thấy lời mời nhận việc {OfferId}.", request.OfferId);
            throw new NotFoundException("Không tìm thấy lời mời nhận việc.");
        }

        if (offer.Application?.Candidate?.UserId != request.CurrentUserId)
        {
            _logger.LogWarning("User {UserId} không phải là ứng viên sở hữu offer {OfferId}.",
                request.CurrentUserId, request.OfferId);
            throw new ForbiddenException("Chỉ ứng viên sở hữu lời mời nhận việc này mới có quyền phản hồi.");
        }

        if (request.ConcurrencyToken.HasValue && request.ConcurrencyToken.Value != offer.ConcurrencyToken)
        {
            _logger.LogWarning("Xung đột phiên bản cho offer {OfferId}.", request.OfferId);
            throw new ConflictException("Dữ liệu offer đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
        }

        if (offer.Status != "SENT")
        {
            _logger.LogWarning("Offer {OfferId} đang ở trạng thái {Status}, không thể phản hồi.",
                offer.OfferId, offer.Status);
            throw new BadRequestException($"Chỉ có thể phản hồi khi offer đang ở trạng thái SENT. Trạng thái hiện tại: {offer.Status}.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (offer.ExpiryDate.HasValue && offer.ExpiryDate.Value < today)
        {
            _logger.LogWarning("Offer {OfferId} đã hết hạn vào ngày {ExpiryDate}.", offer.OfferId, offer.ExpiryDate);
            throw new BadRequestException("Lời mời nhận việc đã hết hạn phản hồi.");
        }

        var now = DateTime.UtcNow;
        offer.RespondedAt = now;
        offer.UpdatedAt = now;
        offer.ConcurrencyToken = Guid.NewGuid();

        var application = offer.Application;
        var oldAppStatus = application?.Status;

        if (normalizedResponse == "ACCEPTED")
        {
            offer.Status = "ACCEPTED";

            if (application != null)
            {
                application.Status = "OFFER_ACCEPTED";
                application.StatusReason = "Ứng viên đã chấp nhận lời mời nhận việc.";
                if (offer.StartDate.HasValue)
                {
                    application.PlannedStartDate = offer.StartDate.Value;
                }
                application.UpdatedAt = now;
                application.ConcurrencyToken = Guid.NewGuid();

                application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
                {
                    ApplicationStatusHistoryId = Guid.NewGuid(),
                    ApplicationId = application.ApplicationId,
                    OldStatus = oldAppStatus,
                    NewStatus = "OFFER_ACCEPTED",
                    ChangedBy = request.CurrentUserId,
                    ChangedAt = now,
                    Reason = "Ứng viên đã chấp nhận lời mời nhận việc (Offer accepted)."
                });

                _applicationRepository.Update(application);
            }
        }
        else // DECLINED
        {
            offer.Status = "DECLINED";
            offer.DeclineReason = request.DeclineReason!.Trim();

            if (application != null)
            {
                application.Status = "OFFER_DECLINED";
                application.StatusReason = $"Ứng viên từ chối offer. Lý do: {offer.DeclineReason}";
                application.UpdatedAt = now;
                application.ConcurrencyToken = Guid.NewGuid();

                application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
                {
                    ApplicationStatusHistoryId = Guid.NewGuid(),
                    ApplicationId = application.ApplicationId,
                    OldStatus = oldAppStatus,
                    NewStatus = "OFFER_DECLINED",
                    ChangedBy = request.CurrentUserId,
                    ChangedAt = now,
                    Reason = $"Ứng viên từ chối offer: {offer.DeclineReason}"
                });

                _applicationRepository.Update(application);
            }
        }

        _offerRepository.Update(offer);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Ứng viên {UserId} đã phản hồi {Response} cho offer {OfferId}.",
            request.CurrentUserId, offer.Status, offer.OfferId);

        return new RespondToOfferResponse(
            offer.OfferId,
            offer.ApplicationId,
            offer.OfferVersion,
            offer.Status,
            offer.RespondedAt.Value,
            offer.DeclineReason,
            application?.Status ?? string.Empty,
            application?.PlannedStartDate,
            offer.ConcurrencyToken,
            offer.UpdatedAt
        );
    }
}
