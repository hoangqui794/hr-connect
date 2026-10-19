using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Offers.Commands.SendOffer;

public class SendOfferCommandHandler : IRequestHandler<SendOfferCommand, SendOfferResponse>
{
    private readonly IOfferRepository _offerRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<SendOfferCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationRepository? _notificationRepository;
    private readonly ICandidateRecruitmentDeliveryService? _candidateDeliveryService;

    public SendOfferCommandHandler(
        IOfferRepository offerRepository,
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<SendOfferCommandHandler> logger,
        IAuditLogService auditLogService,
        INotificationRepository? notificationRepository = null,
        ICandidateRecruitmentDeliveryService? candidateDeliveryService = null)
    {
        _offerRepository = offerRepository;
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
        _notificationRepository = notificationRepository;
        _candidateDeliveryService = candidateDeliveryService;
    }

    public async Task<SendOfferResponse> Handle(SendOfferCommand request, CancellationToken cancellationToken)
    {
        var offer = await _offerRepository.GetByIdWithApplicationAsync(request.OfferId, cancellationToken);
        if (offer == null)
        {
            _logger.LogWarning("Không tìm thấy lời mời nhận việc {OfferId}.", request.OfferId);
            throw new NotFoundException("Không tìm thấy lời mời nhận việc.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, offer.ConcurrencyToken, "offer");

        if (offer.Status != "DRAFT")
        {
            _logger.LogWarning("Offer {OfferId} đang ở trạng thái {Status}, không thể gửi.",
                offer.OfferId, offer.Status);
            throw new BadRequestException($"Chỉ có thể gửi offer khi đang ở trạng thái DRAFT. Trạng thái hiện tại: {offer.Status}.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (offer.ExpiryDate.HasValue && offer.ExpiryDate.Value < today)
        {
            throw new BadRequestException("Offer đã quá hạn phản hồi, không thể gửi. Vui lòng cập nhật hạn phản hồi trước khi gửi.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(companyUser))
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (offer.Application?.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố gửi offer cho job của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, offer.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền gửi offer của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền gửi offer.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền gửi offer.");
        }

        var monthlyGrossSalary = OfferSalaryPolicy.EnsureReadyForSending(
            offer,
            offer.Application?.Job?.ServiceType?.Code);

        // Sending an offer is a state transition visible to the Candidate. Do not persist it
        // unless an account notification or a valid fallback email can be delivered.
        var requiredDelivery = _candidateDeliveryService?.RequireReachable(offer.Application?.Candidate);

        var oldStatus = offer.Status;
        var now = DateTime.UtcNow;
        offer.Status = "SENT";
        offer.SentAt = now;
        offer.UpdatedAt = now;
        offer.ConcurrencyToken = Guid.NewGuid();

        if (offer.Application != null)
        {
            offer.Application.StatusReason = $"Đã gửi thư mời nhận việc (phiên bản {offer.OfferVersion}) tới ứng viên.";
            offer.Application.UpdatedAt = now;
            offer.Application.ConcurrencyToken = Guid.NewGuid();
            _applicationRepository.Update(offer.Application);
        }

        _offerRepository.Update(offer);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.OfferSent,
            EntityType = "OFFER",
            EntityId = offer.OfferId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new
            {
                applicationId = offer.ApplicationId,
                offerVersion = offer.OfferVersion,
                status = offer.Status,
                sentAt = offer.SentAt,
                expiryDate = offer.ExpiryDate,
                salary = offer.Salary,
                currencyCode = offer.CurrencyCode,
                salaryBasis = offer.SalaryBasis,
                salaryPeriod = offer.SalaryPeriod,
                monthlyGrossSalary
            }
        }, cancellationToken);

        CandidateRecruitmentDeliveryOutcome? deliveryOutcome = null;
        if (_candidateDeliveryService != null)
        {
            deliveryOutcome = await _candidateDeliveryService.DeliverOfferAsync(
                offer,
                OfferCandidateDeliveryEvent.Sent,
                reason: null,
                occurredAt: now,
                decision: requiredDelivery,
                cancellationToken: cancellationToken);
        }
        else if (_notificationRepository != null && offer.Application?.Candidate?.UserId is { } candidateUserId)
        {
            var companyName = offer.Application?.Job?.Company?.CompanyName;
            var jobTitle = offer.Application?.Job?.Title;
            await _notificationRepository.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = candidateUserId,
                NotificationType = "OFFER",
                Title = "Bạn nhận được lời mời nhận việc (Offer)",
                Message = string.IsNullOrWhiteSpace(companyName)
                    ? $"Bạn vừa nhận được lời mời nhận việc cho vị trí {jobTitle}."
                    : $"Bạn vừa nhận được lời mời nhận việc cho vị trí {jobTitle} từ {companyName}.",
                RelatedEntityType = "OFFER",
                RelatedEntityId = offer.OfferId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    applicationId = offer.ApplicationId,
                    offerId = offer.OfferId,
                    offerVersion = offer.OfferVersion,
                    expiryDate = offer.ExpiryDate,
                    startDate = offer.StartDate,
                    salaryBasis = offer.SalaryBasis,
                    salaryPeriod = offer.SalaryPeriod,
                    monthlyGrossSalary
                }),
                IsRead = false,
                CreatedAt = now
            }, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã gửi thành công offer {OfferId} phiên bản {Version} cho ứng viên.",
            offer.OfferId, offer.OfferVersion);

        return new SendOfferResponse(
            offer.OfferId,
            offer.ApplicationId,
            offer.OfferVersion,
            offer.Status,
            offer.SentAt.Value,
            offer.ExpiryDate,
            offer.StartDate,
            offer.Salary,
            offer.CurrencyCode,
            offer.SalaryBasis,
            offer.SalaryPeriod,
            monthlyGrossSalary,
            offer.OfferDocumentUrl,
            offer.ConcurrencyToken,
            offer.UpdatedAt,
            deliveryOutcome?.Channel.ToString().ToUpperInvariant()
        );
    }
}
