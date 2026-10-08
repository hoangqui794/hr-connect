using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Offers.Commands.UpdateOfferDraft;

public class UpdateOfferDraftCommandHandler : IRequestHandler<UpdateOfferDraftCommand, UpdateOfferDraftResponse>
{
    private readonly IOfferRepository _offerRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateOfferDraftCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;

    public UpdateOfferDraftCommandHandler(
        IOfferRepository offerRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateOfferDraftCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _offerRepository = offerRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    public async Task<UpdateOfferDraftResponse> Handle(UpdateOfferDraftCommand request, CancellationToken cancellationToken)
    {
        if (request.Salary.HasValue && request.Salary.Value < 0)
        {
            throw new BadRequestException("Mức lương không được là số âm.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.ExpiryDate.HasValue && request.ExpiryDate.Value < today)
        {
            throw new BadRequestException("Hạn phản hồi offer không được ở quá khứ.");
        }

        if (request.StartDate.HasValue && request.ExpiryDate.HasValue && request.StartDate.Value < request.ExpiryDate.Value)
        {
            throw new BadRequestException("Ngày bắt đầu làm việc dự kiến không được trước hạn phản hồi offer.");
        }

        var offer = await _offerRepository.GetByIdWithApplicationAsync(request.OfferId, cancellationToken);
        if (offer == null)
        {
            _logger.LogWarning("Không tìm thấy lời mời nhận việc {OfferId}.", request.OfferId);
            throw new NotFoundException("Không tìm thấy lời mời nhận việc.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, offer.ConcurrencyToken, "offer");

        if (offer.Status != "DRAFT")
        {
            _logger.LogWarning("Offer {OfferId} đang ở trạng thái {Status}, không thể chỉnh sửa.",
                offer.OfferId, offer.Status);
            throw new BadRequestException($"Chỉ có thể chỉnh sửa offer khi đang ở trạng thái DRAFT. Trạng thái hiện tại: {offer.Status}.");
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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố sửa offer cho job của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, offer.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền chỉnh sửa offer của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền chỉnh sửa offer.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa offer.");
        }

        var oldValues = new
        {
            salary = offer.Salary,
            currencyCode = offer.CurrencyCode,
            startDate = offer.StartDate,
            expiryDate = offer.ExpiryDate
        };

        if (!string.IsNullOrWhiteSpace(request.CurrencyCode))
        {
            var currency = request.CurrencyCode.Trim().ToUpperInvariant();
            if (currency.Length > 3)
            {
                throw new BadRequestException("Mã tiền tệ không được vượt quá 3 ký tự.");
            }
            offer.CurrencyCode = currency;
        }

        if (request.Salary.HasValue)
        {
            offer.Salary = request.Salary.Value;
        }

        if (request.StartDate.HasValue)
        {
            offer.StartDate = request.StartDate.Value;
        }

        if (request.ExpiryDate.HasValue)
        {
            offer.ExpiryDate = request.ExpiryDate.Value;
        }

        if (request.OfferDocumentUrl != null)
        {
            offer.OfferDocumentUrl = request.OfferDocumentUrl;
        }

        var now = DateTime.UtcNow;
        offer.UpdatedAt = now;
        offer.ConcurrencyToken = Guid.NewGuid();

        _offerRepository.Update(offer);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.OfferUpdated,
            EntityType = "OFFER",
            EntityId = offer.OfferId,
            ActorUserId = request.CurrentUserId,
            OldValues = oldValues,
            NewValues = new
            {
                applicationId = offer.ApplicationId,
                offerVersion = offer.OfferVersion,
                status = offer.Status,
                salary = offer.Salary,
                currencyCode = offer.CurrencyCode,
                startDate = offer.StartDate,
                expiryDate = offer.ExpiryDate
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã cập nhật thành công offer bản nháp {OfferId}.", offer.OfferId);

        return new UpdateOfferDraftResponse(
            offer.OfferId,
            offer.ApplicationId,
            offer.OfferVersion,
            offer.Salary,
            offer.CurrencyCode,
            offer.StartDate,
            offer.ExpiryDate,
            offer.Status,
            offer.OfferDocumentUrl,
            offer.ConcurrencyToken,
            offer.UpdatedAt
        );
    }
}
