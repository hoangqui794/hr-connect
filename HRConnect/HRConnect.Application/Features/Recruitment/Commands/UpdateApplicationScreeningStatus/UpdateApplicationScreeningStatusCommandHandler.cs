using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;

public sealed class UpdateApplicationScreeningStatusCommandHandler
    : IRequestHandler<UpdateApplicationScreeningStatusCommand, UpdateApplicationScreeningStatusResponse>
{
    private static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> AllowedTransitions =
        new Dictionary<string, IReadOnlySet<string>>(StringComparer.Ordinal)
        {
            [ApplicationStates.Submitted] = new HashSet<string>(StringComparer.Ordinal)
            {
                ApplicationStates.Screening,
                ApplicationStates.Shortlisted,
                ApplicationStates.Rejected,
                ApplicationStates.Backup
            },
            [ApplicationStates.Screening] = new HashSet<string>(StringComparer.Ordinal)
            {
                ApplicationStates.Shortlisted,
                ApplicationStates.Rejected,
                ApplicationStates.Backup
            },
            [ApplicationStates.Backup] = new HashSet<string>(StringComparer.Ordinal)
            {
                ApplicationStates.Shortlisted,
                ApplicationStates.BackupNotSelected
            }
        };

    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IServiceTypeRepository _serviceTypeRepository;
    private readonly INotificationRepository _notificationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<UpdateApplicationScreeningStatusCommandHandler> _logger;

    public UpdateApplicationScreeningStatusCommandHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IServiceTypeRepository serviceTypeRepository,
        INotificationRepository notificationRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        ILogger<UpdateApplicationScreeningStatusCommandHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _serviceTypeRepository = serviceTypeRepository;
        _notificationRepository = notificationRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<UpdateApplicationScreeningStatusResponse> Handle(
        UpdateApplicationScreeningStatusCommand request,
        CancellationToken cancellationToken)
    {
        var targetStatus = request.TargetStatus?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(targetStatus))
        {
            throw new BadRequestException("Trạng thái sàng lọc không được để trống.");
        }

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null || application.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển thuộc công việc này.");
        }

        if (request.Actor == ScreeningActor.ClientCompany)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null || !string.Equals(companyUser.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            {
                throw new ForbiddenException("Tài khoản doanh nghiệp không còn hoạt động.");
            }

            if (application.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning(
                    "Company user {UserId} attempted to screen application {ApplicationId} outside company {CompanyId}.",
                    request.CurrentUserId,
                    application.ApplicationId,
                    companyUser.CompanyId);
                throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển thuộc công việc này.");
            }
        }

        var serviceTypeCode = application.Job?.ServiceType?.Code;
        if (serviceTypeCode == null && application.Job != null)
        {
            serviceTypeCode = (await _serviceTypeRepository.GetByIdAsync(application.Job.ServiceTypeId, cancellationToken))?.Code;
        }

        if (!ScreeningPolicy.CanScreen(request.Actor, serviceTypeCode))
        {
            var responsible = ScreeningPolicy.GetResponsibleActor(serviceTypeCode) switch
            {
                ScreeningActor.ClientCompany => "Client Company sở hữu Job",
                ScreeningActor.InternalHr => "Internal HR",
                _ => null
            };
            throw new ForbiddenException(responsible == null
                ? $"Loại dịch vụ {serviceTypeCode ?? "(không xác định)"} chưa hỗ trợ sàng lọc."
                : $"Hồ sơ thuộc loại dịch vụ {serviceTypeCode} do {responsible} sàng lọc.");
        }

        var currentStatus = application.Status.Trim().ToUpperInvariant();

        // Internal HR performs only the initial pre-screen for agency services.
        // Building or deciding the backup pool remains a Client Company decision.
        if (request.Actor == ScreeningActor.InternalHr)
        {
            if (currentStatus is not (ApplicationStates.Submitted or ApplicationStates.Screening))
            {
                throw new ForbiddenException("Internal HR chỉ được tiền sàng lọc hồ sơ ở trạng thái SUBMITTED hoặc SCREENING.");
            }

            if (targetStatus == ApplicationStates.Backup)
            {
                throw new ForbiddenException("Internal HR không được đưa hồ sơ vào danh sách dự bị.");
            }
        }

        if (!AllowedTransitions.TryGetValue(currentStatus, out var allowedTargets) || !allowedTargets.Contains(targetStatus))
        {
            throw new BadRequestException(
                $"Không thể chuyển hồ sơ từ {currentStatus} sang {targetStatus} trong bước sàng lọc.");
        }

        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        // Format rules live in UpdateApplicationScreeningStatusCommandValidator; this guard keeps
        // a REJECTED decision from ever being stored without a structured reason.
        var reasonCode = targetStatus == ApplicationStates.Rejected
            ? ApplicationReasonCodes.Normalize(request.ReasonCode)
            : null;
        if (targetStatus == ApplicationStates.Rejected
            && (reasonCode == null || !ApplicationReasonCodes.ScreeningRejectionCodes.Contains(reasonCode)))
        {
            throw new BadRequestException("Phải chọn mã lý do hợp lệ khi loại hồ sơ.");
        }

        if (!request.ConcurrencyToken.HasValue)
        {
            throw new BadRequestException("Thiếu concurrencyToken của hồ sơ. Vui lòng tải lại trang.");
        }

        if (request.ConcurrencyToken.Value != application.ConcurrencyToken)
        {
            throw new ConflictException("Dữ liệu hồ sơ đã được thay đổi bởi người khác. Vui lòng tải lại trang.");
        }

        var now = DateTime.UtcNow;
        var newConcurrencyToken = Guid.NewGuid();

        application.Status = targetStatus;
        application.StatusReason = reason;
        application.StatusReasonCode = reasonCode;
        application.UpdatedAt = now;
        application.ConcurrencyToken = newConcurrencyToken;
        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = currentStatus,
            NewStatus = targetStatus,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = reason,
            ReasonCode = reasonCode
        });

        _applicationRepository.Update(application);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationScreened,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = currentStatus },
            NewValues = new
            {
                status = targetStatus,
                hasReason = reason != null,
                reasonCode,
                screenedBy = request.Actor.ToString(),
                serviceType = serviceTypeCode
            }
        }, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationStatusChanged,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = currentStatus },
            NewValues = new { status = targetStatus, sourceAction = AuditActions.ApplicationScreened }
        }, cancellationToken);

        if (targetStatus is ApplicationStates.Shortlisted or ApplicationStates.Rejected)
        {
            await AddScreeningNotificationsAsync(application, targetStatus, now, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new UpdateApplicationScreeningStatusResponse
        {
            Data = new UpdateApplicationScreeningStatusData
            {
                ApplicationId = application.ApplicationId,
                PreviousStatus = currentStatus,
                CurrentStatus = targetStatus,
                Reason = reason,
                ReasonCode = reasonCode,
                ConcurrencyToken = newConcurrencyToken,
                UpdatedAt = now
            }
        };
    }

    private async Task AddScreeningNotificationsAsync(
        HRConnect.Domain.Entities.Application application,
        string targetStatus,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var candidateUserId = application.Candidate?.UserId;
        if (candidateUserId.HasValue
            && !await _notificationRepository.ExistsAsync(
                candidateUserId.Value,
                ApplicationScreeningNotificationFactory.NotificationType,
                "APPLICATION",
                application.ApplicationId,
                cancellationToken))
        {
            await _notificationRepository.AddAsync(
                ApplicationScreeningNotificationFactory.CreateCandidate(application, targetStatus, now), cancellationToken);
        }

        if (application.Attribution?.Affiliate?.UserId is not Guid affiliateUserId
            || affiliateUserId == candidateUserId
            || await _notificationRepository.ExistsAsync(
                affiliateUserId,
                ApplicationScreeningNotificationFactory.NotificationType,
                "APPLICATION",
                application.ApplicationId,
                cancellationToken))
        {
            return;
        }

        await _notificationRepository.AddAsync(
            ApplicationScreeningNotificationFactory.CreateAffiliate(application, targetStatus, now), cancellationToken);
    }
}
