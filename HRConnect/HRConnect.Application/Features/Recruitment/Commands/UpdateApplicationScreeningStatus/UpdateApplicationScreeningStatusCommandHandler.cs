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
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<UpdateApplicationScreeningStatusCommandHandler> _logger;

    public UpdateApplicationScreeningStatusCommandHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IServiceTypeRepository serviceTypeRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        ILogger<UpdateApplicationScreeningStatusCommandHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _serviceTypeRepository = serviceTypeRepository;
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
        if (!AllowedTransitions.TryGetValue(currentStatus, out var allowedTargets) || !allowedTargets.Contains(targetStatus))
        {
            throw new BadRequestException(
                $"Không thể chuyển hồ sơ từ {currentStatus} sang {targetStatus} trong bước sàng lọc.");
        }

        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        if (targetStatus == ApplicationStates.Rejected && reason == null)
        {
            throw new BadRequestException("Phải nhập lý do khi loại hồ sơ.");
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
            Reason = reason
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
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new UpdateApplicationScreeningStatusResponse
        {
            Data = new UpdateApplicationScreeningStatusData
            {
                ApplicationId = application.ApplicationId,
                PreviousStatus = currentStatus,
                CurrentStatus = targetStatus,
                Reason = reason,
                ConcurrencyToken = newConcurrencyToken,
                UpdatedAt = now
            }
        };
    }
}
