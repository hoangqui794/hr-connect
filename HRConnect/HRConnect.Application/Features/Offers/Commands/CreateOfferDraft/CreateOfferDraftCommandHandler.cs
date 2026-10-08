using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Offers.Commands.CreateOfferDraft;

public class CreateOfferDraftCommandHandler : IRequestHandler<CreateOfferDraftCommand, CreateOfferDraftResponse>
{
    private readonly IOfferRepository _offerRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CreateOfferDraftCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;

    public CreateOfferDraftCommandHandler(
        IOfferRepository offerRepository,
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<CreateOfferDraftCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _offerRepository = offerRepository;
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    public async Task<CreateOfferDraftResponse> Handle(CreateOfferDraftCommand request, CancellationToken cancellationToken)
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

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển {ApplicationId}.", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, application.ConcurrencyToken, "hồ sơ");

        if (application.Status != ApplicationStates.OfferPending)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể tạo offer.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Chỉ có thể tạo offer khi hồ sơ đang ở trạng thái {ApplicationStates.OfferPending}. Trạng thái hiện tại: {application.Status}.");
        }

        var existingOffers = await _offerRepository.GetByApplicationIdAsync(application.ApplicationId, cancellationToken);

        if (existingOffers.Any(o => o.Status == OfferStates.Draft))
        {
            throw new BadRequestException("Đã tồn tại một bản nháp offer chưa gửi cho hồ sơ này. Vui lòng cập nhật bản nháp hiện có hoặc gửi đi.");
        }

        if (existingOffers.Any(o => o.Status == OfferStates.Sent))
        {
            throw new BadRequestException("Đang có một offer đã gửi chờ ứng viên phản hồi. Không thể tạo offer mới khi offer trước chưa được xử lý.");
        }

        if (existingOffers.Any(o => o.Status == OfferStates.Accepted))
        {
            throw new BadRequestException("Ứng viên đã chấp nhận offer trước đó.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null)
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (application.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố tạo offer cho job của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, application.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền tạo offer cho ứng viên của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền tạo offer.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền tạo offer.");
        }

        var maxVersion = existingOffers.Count > 0 ? existingOffers.Max(o => o.OfferVersion) : 0;
        var nextVersion = maxVersion + 1;

        var currency = string.IsNullOrWhiteSpace(request.CurrencyCode)
            ? "VND"
            : request.CurrencyCode.Trim().ToUpperInvariant();

        if (currency.Length > 3)
        {
            throw new BadRequestException("Mã tiền tệ không được vượt quá 3 ký tự.");
        }

        var now = DateTime.UtcNow;
        var offerId = Guid.NewGuid();

        var offer = new Offer
        {
            OfferId = offerId,
            ApplicationId = application.ApplicationId,
            OfferVersion = nextVersion,
            Salary = request.Salary,
            CurrencyCode = currency,
            StartDate = request.StartDate,
            ExpiryDate = request.ExpiryDate,
            Status = OfferStates.Draft,
            CreatedBy = request.CurrentUserId,
            OfferDocumentUrl = request.OfferDocumentUrl,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = now,
            UpdatedAt = now
        };

        application.UpdatedAt = now;
        application.ConcurrencyToken = Guid.NewGuid();
        _applicationRepository.Update(application);

        await _offerRepository.AddAsync(offer, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.OfferDraftCreated,
            EntityType = "OFFER",
            EntityId = offer.OfferId,
            ActorUserId = request.CurrentUserId,
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

        _logger.LogInformation("Đã tạo offer bản nháp {OfferId} phiên bản {Version} cho hồ sơ {ApplicationId}.",
            offerId, nextVersion, application.ApplicationId);

        return new CreateOfferDraftResponse(
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
            offer.CreatedAt,
            application.Status
        );
    }
}
