using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
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

    public SendOfferCommandHandler(
        IOfferRepository offerRepository,
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<SendOfferCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _offerRepository = offerRepository;
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    public async Task<SendOfferResponse> Handle(SendOfferCommand request, CancellationToken cancellationToken)
    {
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
            if (companyUser == null)
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
                expiryDate = offer.ExpiryDate
            }
        }, cancellationToken);
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
            offer.OfferDocumentUrl,
            offer.ConcurrencyToken,
            offer.UpdatedAt
        );
    }
}
