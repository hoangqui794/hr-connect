using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Constants;
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
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationRepository? _notificationRepository;
    private readonly IPlacementRepository? _placementRepository;
    private readonly ICandidateTransactionLock? _candidateLock;
    private readonly TimeProvider _timeProvider;

    public RespondToOfferCommandHandler(
        IOfferRepository offerRepository,
        IApplicationRepository applicationRepository,
        IUnitOfWork unitOfWork,
        ILogger<RespondToOfferCommandHandler> logger,
        IAuditLogService auditLogService,
        INotificationRepository? notificationRepository = null,
        IPlacementRepository? placementRepository = null,
        ICandidateTransactionLock? candidateLock = null,
        TimeProvider? timeProvider = null)
    {
        _offerRepository = offerRepository;
        _applicationRepository = applicationRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
        _notificationRepository = notificationRepository;
        _placementRepository = placementRepository;
        _candidateLock = candidateLock;
        _timeProvider = timeProvider ?? TimeProvider.System;
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

        var acceptanceAction = OfferAcceptancePolicy.NormalizeAction(request.AcceptanceAction);
        if (normalizedResponse == OfferStates.Accepted && !OfferAcceptanceActions.All.Contains(acceptanceAction))
        {
            throw new BadRequestException(
                $"Cách xử lý các offer khác '{request.AcceptanceAction}' không hợp lệ.",
                OfferAcceptanceErrorCodes.InvalidAcceptanceAction);
        }

        if (normalizedResponse == OfferStates.Declined &&
            !string.Equals(acceptanceAction, OfferAcceptanceActions.KeepOtherPendingOffers, StringComparison.OrdinalIgnoreCase))
        {
            throw new BadRequestException("Không được gửi cách xử lý offer khác khi từ chối offer.");
        }

        var offer = _candidateLock == null
            ? await _offerRepository.GetByIdWithApplicationAsync(request.OfferId, cancellationToken)
            : await _offerRepository.GetByIdWithDetailsAsync(request.OfferId, cancellationToken);
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

        var transactionActive = false;
        try
        {
            if (normalizedResponse == OfferStates.Accepted && _candidateLock != null)
            {
                await _unitOfWork.BeginTransactionAsync(cancellationToken);
                transactionActive = true;
                await _candidateLock.AcquireAsync(offer.Application.CandidateId, cancellationToken);

                offer = await _offerRepository.GetByIdWithApplicationAsync(request.OfferId, cancellationToken)
                    ?? throw new NotFoundException("Không tìm thấy lời mời nhận việc.");
                if (offer.Application?.Candidate?.UserId != request.CurrentUserId)
                {
                    throw new ForbiddenException("Chỉ ứng viên sở hữu lời mời nhận việc này mới có quyền phản hồi.");
                }
            }

            Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, offer.ConcurrencyToken, "offer");

            if (offer.Status != OfferStates.Sent)
            {
                _logger.LogWarning("Offer {OfferId} đang ở trạng thái {Status}, không thể phản hồi.",
                    offer.OfferId, offer.Status);
                throw new BadRequestException($"Chỉ có thể phản hồi khi offer đang ở trạng thái SENT. Trạng thái hiện tại: {offer.Status}.");
            }

            var today = VietnamTime.Today(_timeProvider);
            if (offer.ExpiryDate.HasValue && offer.ExpiryDate.Value < today)
            {
                _logger.LogWarning("Offer {OfferId} đã hết hạn vào ngày {ExpiryDate}.", offer.OfferId, offer.ExpiryDate);
                throw new BadRequestException("Lời mời nhận việc đã hết hạn phản hồi.");
            }

            var oldOfferStatus = offer.Status;
            var now = DateTime.UtcNow;
            offer.RespondedAt = now;
            offer.UpdatedAt = now;
            offer.ConcurrencyToken = Guid.NewGuid();

            var application = offer.Application;
            var oldAppStatus = application?.Status;

            if (normalizedResponse == OfferStates.Accepted)
            {
                await ApplyAcceptancePolicyAsync(
                    offer,
                    acceptanceAction,
                    request.CurrentUserId,
                    now,
                    cancellationToken);

                offer.Status = OfferStates.Accepted;

                if (application != null)
                {
                    application.Status = ApplicationStates.OfferAccepted;
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
                        NewStatus = ApplicationStates.OfferAccepted,
                        ChangedBy = request.CurrentUserId,
                        ChangedAt = now,
                        Reason = "Ứng viên đã chấp nhận lời mời nhận việc (Offer accepted)."
                    });

                    _applicationRepository.Update(application);
                }
            }
            else // DECLINED
            {
                offer.Status = OfferStates.Declined;
                offer.DeclineReason = request.DeclineReason!.Trim();

                if (application != null)
                {
                    application.Status = ApplicationStates.OfferDeclined;
                    application.StatusReason = $"Ứng viên từ chối offer. Lý do: {offer.DeclineReason}";
                    application.UpdatedAt = now;
                    application.ConcurrencyToken = Guid.NewGuid();

                    application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
                    {
                        ApplicationStatusHistoryId = Guid.NewGuid(),
                        ApplicationId = application.ApplicationId,
                        OldStatus = oldAppStatus,
                        NewStatus = ApplicationStates.OfferDeclined,
                        ChangedBy = request.CurrentUserId,
                        ChangedAt = now,
                        Reason = $"Ứng viên từ chối offer: {offer.DeclineReason}"
                    });

                    _applicationRepository.Update(application);
                }
            }

            _offerRepository.Update(offer);
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = normalizedResponse == "ACCEPTED" ? AuditActions.OfferAccepted : AuditActions.OfferDeclined,
                EntityType = "OFFER",
                EntityId = offer.OfferId,
                ActorUserId = request.CurrentUserId,
                OldValues = new { status = oldOfferStatus },
                NewValues = new
                {
                    applicationId = offer.ApplicationId,
                    offerVersion = offer.OfferVersion,
                    status = offer.Status,
                    respondedAt = offer.RespondedAt,
                    hasDeclineReason = !string.IsNullOrWhiteSpace(offer.DeclineReason)
                }
            }, cancellationToken);
            if (oldAppStatus != null && oldAppStatus != application?.Status)
            {
                await _auditLogService.AddAsync(new AuditEntry
                {
                    Action = AuditActions.ApplicationStatusChanged,
                    EntityType = "APPLICATION",
                    EntityId = offer.ApplicationId,
                    ActorUserId = request.CurrentUserId,
                    OldValues = new { status = oldAppStatus },
                    NewValues = new { status = application!.Status, sourceAction = normalizedResponse == "ACCEPTED" ? AuditActions.OfferAccepted : AuditActions.OfferDeclined }
                }, cancellationToken);
            }

            if (_notificationRepository != null && offer.CreatedBy is { } offerCreatorId && offerCreatorId != Guid.Empty)
            {
                var isAccepted = normalizedResponse == "ACCEPTED";
                await _notificationRepository.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = offerCreatorId,
                    NotificationType = "OFFER",
                    Title = isAccepted ? "Ứng viên đã chấp nhận lời mời nhận việc" : "Ứng viên đã từ chối lời mời nhận việc",
                    Message = isAccepted
                        ? $"Ứng viên {application?.Candidate?.FullName} đã chấp nhận Offer cho vị trí {application?.Job?.Title}."
                        : $"Ứng viên {application?.Candidate?.FullName} đã từ chối Offer cho vị trí {application?.Job?.Title}.",
                    RelatedEntityType = "OFFER",
                    RelatedEntityId = offer.OfferId,
                    Metadata = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        applicationId = offer.ApplicationId,
                        offerId = offer.OfferId,
                        status = offer.Status,
                        declineReason = offer.DeclineReason,
                        routeHint = $"/client/candidates?open={offer.ApplicationId}"
                    }),
                    IsRead = false,
                    CreatedAt = now
                }, cancellationToken);
            }

            if (transactionActive)
            {
                await _unitOfWork.CommitTransactionAsync(cancellationToken);
                transactionActive = false;
            }
            else
            {
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

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
        catch
        {
            if (transactionActive)
            {
                await _unitOfWork.RollbackTransactionAsync(CancellationToken.None);
            }

            throw;
        }
    }

    private async Task ApplyAcceptancePolicyAsync(
        Offer targetOffer,
        string acceptanceAction,
        Guid actorUserId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var application = targetOffer.Application;
        if (application == null || !OfferAcceptancePolicy.IsFullTime(application.Job?.EmploymentType))
        {
            if (!string.Equals(acceptanceAction, OfferAcceptanceActions.KeepOtherPendingOffers, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException(
                    "Chỉ offer toàn thời gian mới hỗ trợ rút hoặc thay thế các offer toàn thời gian khác.",
                    OfferAcceptanceErrorCodes.InvalidAcceptanceAction);
            }

            return;
        }

        if (_placementRepository != null)
        {
            var activePlacement = await _placementRepository.GetActiveFullTimeForCandidateAsync(
                application.CandidateId,
                application.ApplicationId,
                cancellationToken);
            if (activePlacement != null)
            {
                if (!string.Equals(acceptanceAction, OfferAcceptanceActions.TransitionFromActivePlacement, StringComparison.OrdinalIgnoreCase))
                {
                    throw new ConflictException(
                        "Bạn đang có một vị trí toàn thời gian đã xác nhận đi làm. Vui lòng xác nhận cam kết chuyển việc nếu muốn tiếp tục.",
                        OfferAcceptanceErrorCodes.ActiveFullTimePlacementExists,
                        new Dictionary<string, object?>
                        {
                            ["applicationId"] = activePlacement.ApplicationId,
                            ["jobTitle"] = activePlacement.Application?.Job?.Title,
                            ["companyName"] = activePlacement.Application?.Job?.Company?.CompanyName
                        });
                }
            }
        }

        var otherOffers = await _offerRepository.GetCandidateOffersForAcceptanceAsync(
            application.CandidateId,
            targetOffer.OfferId,
            cancellationToken) ?? Array.Empty<Offer>();
        var acceptedFullTimeOffers = otherOffers
            .Where(IsFullTimeOffer)
            .Where(o => string.Equals(o.Status, OfferStates.Accepted, StringComparison.OrdinalIgnoreCase))
            .Where(o => !HasPlacementRecord(o))
            .ToList();

        if (acceptedFullTimeOffers.Count > 0 &&
            !string.Equals(acceptanceAction, OfferAcceptanceActions.ReplaceAcceptedFullTimeOffer, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(acceptanceAction, OfferAcceptanceActions.TransitionFromActivePlacement, StringComparison.OrdinalIgnoreCase))
        {
            var accepted = acceptedFullTimeOffers[0];
            throw new ConflictException(
                "Bạn đã chấp nhận một offer toàn thời gian khác. Hãy xác nhận chuyển offer nếu muốn tiếp tục.",
                OfferAcceptanceErrorCodes.AcceptedFullTimeOfferExists,
                new Dictionary<string, object?>
                {
                    ["offerId"] = accepted.OfferId,
                    ["applicationId"] = accepted.ApplicationId,
                    ["jobTitle"] = accepted.Application?.Job?.Title,
                    ["companyName"] = accepted.Application?.Job?.Company?.CompanyName
                });
        }

        if (string.Equals(acceptanceAction, OfferAcceptanceActions.ReplaceAcceptedFullTimeOffer, StringComparison.OrdinalIgnoreCase) ||
            (string.Equals(acceptanceAction, OfferAcceptanceActions.TransitionFromActivePlacement, StringComparison.OrdinalIgnoreCase) && acceptedFullTimeOffers.Count > 0))
        {
            if (string.Equals(acceptanceAction, OfferAcceptanceActions.ReplaceAcceptedFullTimeOffer, StringComparison.OrdinalIgnoreCase) && acceptedFullTimeOffers.Count == 0)
            {
                throw new BadRequestException(
                    "Không có offer toàn thời gian đã chấp nhận để thay thế.",
                    OfferAcceptanceErrorCodes.InvalidAcceptanceAction);
            }

            foreach (var competing in acceptedFullTimeOffers)
            {
                await WithdrawCompetingOfferAsync(
                    competing,
                    actorUserId,
                    now,
                    "Ứng viên đã chuyển sang một lời mời nhận việc toàn thời gian khác.",
                    cancellationToken);
            }
        }

        if (string.Equals(acceptanceAction, OfferAcceptanceActions.WithdrawOtherPendingFullTimeOffers, StringComparison.OrdinalIgnoreCase))
        {
            foreach (var competing in otherOffers
                         .Where(IsFullTimeOffer)
                         .Where(o => string.Equals(o.Status, OfferStates.Sent, StringComparison.OrdinalIgnoreCase))
                         .Where(o => !HasPlacementRecord(o)))
            {
                await WithdrawCompetingOfferAsync(
                    competing,
                    actorUserId,
                    now,
                    "Ứng viên đã rút khỏi quy trình tuyển dụng sau khi chấp nhận một lời mời khác.",
                    cancellationToken);
            }
        }
    }

    private async Task WithdrawCompetingOfferAsync(
        Offer offer,
        Guid actorUserId,
        DateTime now,
        string reason,
        CancellationToken cancellationToken)
    {
        // A placement is a completed business event with downstream fee,
        // warranty and commission records. Accepting another offer must never
        // rewrite that historical employment flow as WITHDRAWN.
        if (HasPlacementRecord(offer))
        {
            return;
        }

        var oldOfferStatus = offer.Status;
        offer.Status = OfferStates.Withdrawn;
        offer.DeclineReason = reason;
        // Preserve the original acceptance time when an already accepted offer
        // is replaced. UpdatedAt records when the withdrawal happened.
        offer.RespondedAt ??= now;
        offer.UpdatedAt = now;
        offer.ConcurrencyToken = Guid.NewGuid();
        _offerRepository.Update(offer);

        var application = offer.Application;
        var oldApplicationStatus = application.Status;
        application.Status = ApplicationStates.Withdrawn;
        application.StatusReason = reason;
        application.UpdatedAt = now;
        application.ConcurrencyToken = Guid.NewGuid();
        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = oldApplicationStatus,
            NewStatus = ApplicationStates.Withdrawn,
            ChangedBy = actorUserId,
            ChangedAt = now,
            Reason = reason
        });
        _applicationRepository.Update(application);

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.OfferWithdrawn,
            EntityType = "OFFER",
            EntityId = offer.OfferId,
            ActorUserId = actorUserId,
            OldValues = new { status = oldOfferStatus },
            NewValues = new { status = offer.Status, applicationId = offer.ApplicationId, reasonCode = "ACCEPTED_ANOTHER_OFFER" }
        }, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationStatusChanged,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = actorUserId,
            OldValues = new { status = oldApplicationStatus },
            NewValues = new { status = application.Status, sourceAction = AuditActions.OfferWithdrawn }
        }, cancellationToken);

        if (_notificationRepository != null && offer.CreatedBy is { } creatorId && creatorId != Guid.Empty)
        {
            await _notificationRepository.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = creatorId,
                NotificationType = "OFFER",
                Title = "Ứng viên đã rút khỏi quy trình tuyển dụng",
                Message = $"Ứng viên {application.Candidate?.FullName} đã rút hồ sơ cho vị trí {application.Job?.Title}.",
                RelatedEntityType = "OFFER",
                RelatedEntityId = offer.OfferId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    applicationId = application.ApplicationId,
                    offerId = offer.OfferId,
                    status = offer.Status,
                    routeHint = $"/client/candidates?open={application.ApplicationId}"
                }),
                IsRead = false,
                CreatedAt = now
            }, cancellationToken);
        }
    }

    private static bool HasPlacementRecord(Offer offer) =>
        offer.Application?.Placement != null ||
        string.Equals(
            offer.Application?.Status,
            ApplicationStates.Placed,
            StringComparison.OrdinalIgnoreCase);

    private static bool IsFullTimeOffer(Offer offer) =>
        OfferAcceptancePolicy.IsFullTime(offer.Application?.Job?.EmploymentType);
}
