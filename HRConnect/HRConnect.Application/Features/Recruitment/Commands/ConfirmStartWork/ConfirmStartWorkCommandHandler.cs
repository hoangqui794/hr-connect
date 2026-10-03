using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;

public class ConfirmStartWorkCommandHandler : IRequestHandler<ConfirmStartWorkCommand, ConfirmStartWorkResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly IOfferRepository _offerRepository;
    private readonly IPlacementRepository _placementRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ConfirmStartWorkCommandHandler> _logger;

    public ConfirmStartWorkCommandHandler(
        IApplicationRepository applicationRepository,
        IOfferRepository offerRepository,
        IPlacementRepository placementRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<ConfirmStartWorkCommandHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _offerRepository = offerRepository;
        _placementRepository = placementRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ConfirmStartWorkResponse> Handle(ConfirmStartWorkCommand request, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.ActualStartDate > today)
        {
            throw new BadRequestException("Ngày thực tế đi làm không được ở tương lai.");
        }

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển {ApplicationId}.", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");
        }

        if (request.ConcurrencyToken.HasValue && request.ConcurrencyToken.Value != application.ConcurrencyToken)
        {
            _logger.LogWarning("Xung đột phiên bản cho hồ sơ {ApplicationId}.", request.ApplicationId);
            throw new ConflictException("Dữ liệu hồ sơ đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố xác nhận đi làm cho hồ sơ của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, application.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền xác nhận đi làm cho ứng viên của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền xác nhận bắt đầu làm việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền xác nhận ứng viên bắt đầu làm việc.");
        }

        if (application.Status != ApplicationStates.OfferAccepted)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể xác nhận đi làm.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Chỉ có thể xác nhận đi làm khi hồ sơ ở trạng thái {ApplicationStates.OfferAccepted}. Trạng thái hiện tại: {application.Status}.");
        }

        var existingPlacement = await _placementRepository.GetByApplicationIdAsync(request.ApplicationId, cancellationToken);
        if (existingPlacement != null)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đã có Placement {PlacementId}.",
                request.ApplicationId, existingPlacement.PlacementId);
            throw new ConflictException("Hồ sơ ứng tuyển này đã có thông tin tiếp nhận việc (Placement).");
        }

        var offer = await _offerRepository.GetByIdAsync(request.OfferId, cancellationToken);
        if (offer == null || offer.ApplicationId != application.ApplicationId)
        {
            _logger.LogWarning("Thư mời nhận việc {OfferId} không tồn tại hoặc không thuộc hồ sơ {ApplicationId}.",
                request.OfferId, request.ApplicationId);
            throw new BadRequestException("Thư mời nhận việc không tồn tại hoặc không thuộc hồ sơ này.");
        }

        if (!string.Equals(offer.Status, OfferStates.Accepted, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Thư mời nhận việc {OfferId} chưa được chấp thuận (Status: {Status}).",
                offer.OfferId, offer.Status);
            throw new BadRequestException($"Chỉ có thể xác nhận bắt đầu làm việc khi thư mời nhận việc đã được chấp nhận (ACCEPTED). Trạng thái hiện tại: {offer.Status}.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = application.Status;
        var newConcurrencyToken = Guid.NewGuid();

        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OfferId = offer.OfferId,
            ActualStartDate = request.ActualStartDate,
            Position = !string.IsNullOrWhiteSpace(request.Position) ? request.Position.Trim() : application.Job?.Title,
            Department = request.Department?.Trim(),
            Status = PlacementStates.Started,
            ConfirmedBy = request.CurrentUserId,
            ConfirmedAt = now,
            ConfirmationNote = request.ConfirmationNote?.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };

        await _placementRepository.AddAsync(placement, cancellationToken);

        application.Status = ApplicationStates.Placed;
        application.UpdatedAt = now;
        application.ConcurrencyToken = newConcurrencyToken;

        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = oldStatus,
            NewStatus = ApplicationStates.Placed,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = request.ConfirmationNote?.Trim() ?? "Xác nhận ứng viên đã bắt đầu làm việc (Placement started)."
        });

        _applicationRepository.Update(application);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã xác nhận ứng viên bắt đầu làm việc cho hồ sơ {ApplicationId}, Placement {PlacementId}.",
            application.ApplicationId, placement.PlacementId);

        return new ConfirmStartWorkResponse(
            application.ApplicationId,
            application.Status,
            placement.PlacementId,
            placement.ActualStartDate,
            application.ConcurrencyToken,
            new List<string> { "VIEW_PLACEMENT" }
        );
    }
}
