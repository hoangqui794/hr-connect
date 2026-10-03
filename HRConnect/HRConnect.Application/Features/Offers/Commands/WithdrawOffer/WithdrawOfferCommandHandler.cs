using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Offers.Commands.WithdrawOffer;

public class WithdrawOfferCommandHandler : IRequestHandler<WithdrawOfferCommand, WithdrawOfferResponse>
{
    private readonly IOfferRepository _offerRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<WithdrawOfferCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;

    public WithdrawOfferCommandHandler(
        IOfferRepository offerRepository,
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<WithdrawOfferCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _offerRepository = offerRepository;
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    public async Task<WithdrawOfferResponse> Handle(WithdrawOfferCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BadRequestException("Vui lòng cung cấp lý do thu hồi offer.");
        }

        var offer = await _offerRepository.GetByIdWithApplicationAsync(request.OfferId, cancellationToken);
        if (offer == null)
        {
            _logger.LogWarning("Không tìm thấy lời mời nhận việc {OfferId}.", request.OfferId);
            throw new NotFoundException("Không tìm thấy lời mời nhận việc.");
        }

        if (request.ConcurrencyToken.HasValue && request.ConcurrencyToken.Value != offer.ConcurrencyToken)
        {
            _logger.LogWarning("Xung đột phiên bản cho offer {OfferId}.", request.OfferId);
            throw new ConflictException("Dữ liệu offer đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null)
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (offer.Application?.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố thu hồi offer cho job của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, offer.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền thu hồi offer của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền thu hồi offer.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền thu hồi offer.");
        }

        if (offer.Status == "ACCEPTED")
        {
            _logger.LogWarning("Offer {OfferId} đã được chấp nhận, không thể thu hồi.", offer.OfferId);
            throw new BadRequestException("Không thể thu hồi offer đã được ứng viên chấp nhận.");
        }

        if (offer.Status is "WITHDRAWN" or "DECLINED")
        {
            _logger.LogWarning("Offer {OfferId} đang ở trạng thái {Status}, không thể thu hồi.",
                offer.OfferId, offer.Status);
            throw new BadRequestException($"Không thể thu hồi offer đang ở trạng thái {offer.Status}.");
        }

        var oldOfferStatus = offer.Status;
        var now = DateTime.UtcNow;
        var trimmedReason = request.Reason.Trim();

        offer.Status = "WITHDRAWN";
        offer.DeclineReason = trimmedReason;
        offer.UpdatedAt = now;
        offer.ConcurrencyToken = Guid.NewGuid();

        var application = offer.Application;
        var oldApplicationStatus = application?.Status;
        if (application != null)
        {
            var oldStatus = application.Status;
            application.Status = "OFFER_PENDING";
            application.StatusReason = $"Thu hồi offer phiên bản {offer.OfferVersion}. Lý do: {trimmedReason}";
            application.UpdatedAt = now;
            application.ConcurrencyToken = Guid.NewGuid();

            application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
            {
                ApplicationStatusHistoryId = Guid.NewGuid(),
                ApplicationId = application.ApplicationId,
                OldStatus = oldStatus,
                NewStatus = "OFFER_PENDING",
                ChangedBy = request.CurrentUserId,
                ChangedAt = now,
                Reason = $"Thu hồi offer phiên bản {offer.OfferVersion}: {trimmedReason}"
            });

            _applicationRepository.Update(application);
        }

        _offerRepository.Update(offer);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.OfferWithdrawn,
            EntityType = "OFFER",
            EntityId = offer.OfferId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldOfferStatus },
            NewValues = new
            {
                applicationId = offer.ApplicationId,
                offerVersion = offer.OfferVersion,
                status = offer.Status,
                hasReason = true
            }
        }, cancellationToken);
        if (application != null && oldApplicationStatus != application.Status)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.ApplicationStatusChanged,
                EntityType = "APPLICATION",
                EntityId = application.ApplicationId,
                ActorUserId = request.CurrentUserId,
                OldValues = new { status = oldApplicationStatus },
                NewValues = new { status = application.Status, sourceAction = AuditActions.OfferWithdrawn }
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã thu hồi thành công offer {OfferId} phiên bản {Version}.",
            offer.OfferId, offer.OfferVersion);

        return new WithdrawOfferResponse(
            offer.OfferId,
            offer.ApplicationId,
            offer.OfferVersion,
            offer.Status,
            trimmedReason,
            application?.Status ?? "OFFER_PENDING",
            offer.ConcurrencyToken,
            offer.UpdatedAt
        );
    }
}
