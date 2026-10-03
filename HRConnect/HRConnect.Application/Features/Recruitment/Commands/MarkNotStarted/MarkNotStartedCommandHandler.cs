using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;

public class MarkNotStartedCommandHandler : IRequestHandler<MarkNotStartedCommand, MarkNotStartedResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly IPlacementRepository _placementRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<MarkNotStartedCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;

    public MarkNotStartedCommandHandler(
        IApplicationRepository applicationRepository,
        IPlacementRepository placementRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<MarkNotStartedCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _applicationRepository = applicationRepository;
        _placementRepository = placementRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    public async Task<MarkNotStartedResponse> Handle(MarkNotStartedCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BadRequestException("Lý do không đến nhận việc là bắt buộc.");
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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố đánh dấu không nhận việc cho hồ sơ của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, application.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền đánh dấu không nhận việc cho ứng viên của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền đánh dấu ứng viên không nhận việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền đánh dấu ứng viên không nhận việc.");
        }

        if (string.Equals(application.Status, ApplicationStates.NotStarted, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đã ở trạng thái NOT_STARTED.", application.ApplicationId);
            throw new BadRequestException("Hồ sơ ứng tuyển đã ở trạng thái không nhận việc (NOT_STARTED).");
        }

        if (application.Status != ApplicationStates.OfferAccepted)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể đánh dấu không nhận việc.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Chỉ có thể đánh dấu không nhận việc sau khi ứng viên chấp nhận offer ({ApplicationStates.OfferAccepted}). Trạng thái hiện tại: {application.Status}.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = application.Status;
        var newConcurrencyToken = Guid.NewGuid();
        var trimmedReason = request.Reason.Trim();

        var placement = await _placementRepository.GetByApplicationIdAsync(request.ApplicationId, cancellationToken);
        if (placement != null)
        {
            throw new ConflictException("Hồ sơ đã có Placement; không thể chuyển ngược sang NOT_STARTED.");
        }

        application.Status = ApplicationStates.NotStarted;
        application.StatusReason = trimmedReason;
        application.UpdatedAt = now;
        application.ConcurrencyToken = newConcurrencyToken;

        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = oldStatus,
            NewStatus = ApplicationStates.NotStarted,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = trimmedReason
        });

        _applicationRepository.Update(application);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationNotStarted,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = application.Status, hasReason = true }
        }, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationStatusChanged,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = application.Status, sourceAction = AuditActions.ApplicationNotStarted }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã đánh dấu hồ sơ {ApplicationId} thành NOT_STARTED. Lý do: {Reason}",
            application.ApplicationId, trimmedReason);

        return new MarkNotStartedResponse(
            application.ApplicationId,
            application.Status,
            application.StatusReason,
            application.ConcurrencyToken,
            application.UpdatedAt
        );
    }
}
