using System;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using HRConnect.Application.Common;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmPlannedStartDate;

public class ConfirmPlannedStartDateCommandHandler : IRequestHandler<ConfirmPlannedStartDateCommand, ConfirmPlannedStartDateResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ConfirmPlannedStartDateCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;
    private readonly IAuditLogRepository? _auditLogRepository;
    private readonly ICandidateRecruitmentDeliveryService? _candidateDeliveryService;

    private const int MaxChanges = 3;
    private const int MaxDelayDays = 60;

    public ConfirmPlannedStartDateCommandHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<ConfirmPlannedStartDateCommandHandler> logger,
        IAuditLogService auditLogService,
        IAuditLogRepository? auditLogRepository = null,
        ICandidateRecruitmentDeliveryService? candidateDeliveryService = null)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
        _auditLogRepository = auditLogRepository;
        _candidateDeliveryService = candidateDeliveryService;
    }

    public async Task<ConfirmPlannedStartDateResponse> Handle(ConfirmPlannedStartDateCommand request, CancellationToken cancellationToken)
    {
        var today = VietnamTime.Today();
        if (request.PlannedStartDate < today)
        {
            throw new BadRequestException("Ngày dự kiến nhận việc không được ở quá khứ.");
        }

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển {ApplicationId}.", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, application.ConcurrencyToken, "hồ sơ");

        if (application.Status != ApplicationStates.OfferAccepted)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể cập nhật ngày nhận việc.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Chỉ có thể cập nhật ngày nhận việc sau khi ứng viên chấp nhận offer ({ApplicationStates.OfferAccepted}). Trạng thái hiện tại: {application.Status}.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(companyUser))
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (application.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố sửa ngày nhận việc cho job của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, application.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền cập nhật ngày nhận việc cho ứng viên của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền cập nhật ngày nhận việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền cập nhật ngày nhận việc.");
        }

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new BadRequestException("Lý do dời ngày nhận việc là bắt buộc.");
        }
        if (reason.Length > 1000)
        {
            throw new BadRequestException("Lý do dời ngày nhận việc tối đa 1000 ký tự.");
        }
        if (application.PlannedStartDate == request.PlannedStartDate)
        {
            throw new BadRequestException("Ngày nhận việc mới phải khác ngày hiện tại.");
        }

        var changeCount = 0;
        if (_auditLogRepository != null)
        {
            (_, changeCount) = await _auditLogRepository.GetListAsync(
                actorUserId: null,
                actorType: null,
                action: AuditActions.ApplicationPlannedStartDateUpdated,
                source: null,
                serviceName: null,
                entityType: "APPLICATION",
                entityId: application.ApplicationId,
                correlationId: null,
                fromUtc: null,
                toUtc: null,
                page: 1,
                pageSize: 1,
                cancellationToken: cancellationToken);
            if (changeCount >= MaxChanges)
            {
                throw new BadRequestException("Đã dời ngày nhận việc tối đa 3 lần. Vui lòng xác nhận đi làm hoặc báo không bắt đầu làm việc.");
            }
        }

        var agreedOfferDate = application.Offers
            .Where(o => string.Equals(o.Status, OfferStates.Accepted, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(o => o.RespondedAt ?? o.UpdatedAt)
            .Select(o => o.StartDate)
            .FirstOrDefault(date => date.HasValue)
            ?? application.PlannedStartDate;
        if (agreedOfferDate.HasValue && request.PlannedStartDate > agreedOfferDate.Value.AddDays(MaxDelayDays))
        {
            throw new BadRequestException($"Ngày nhận việc mới không được muộn quá {MaxDelayDays} ngày so với ngày đã thỏa thuận trong offer.");
        }

        var now = DateTime.UtcNow;
        var oldPlannedStartDate = application.PlannedStartDate;
        application.PlannedStartDate = request.PlannedStartDate;
        application.UpdatedAt = now;
        application.ConcurrencyToken = Guid.NewGuid();

        _applicationRepository.Update(application);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationPlannedStartDateUpdated,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { plannedStartDate = oldPlannedStartDate },
            NewValues = new { plannedStartDate = application.PlannedStartDate, status = application.Status, reason }
        }, cancellationToken);
        if (_candidateDeliveryService != null)
        {
            await _candidateDeliveryService.DeliverPlannedStartDateChangedAsync(
                application,
                oldPlannedStartDate,
                request.PlannedStartDate,
                reason,
                now,
                cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã cập nhật ngày nhận việc cho hồ sơ {ApplicationId} thành {PlannedStartDate}.",
            application.ApplicationId, request.PlannedStartDate);

        return new ConfirmPlannedStartDateResponse(
            application.ApplicationId,
            application.PlannedStartDate.Value,
            application.Status,
            application.StatusReason,
            application.ConcurrencyToken,
            application.UpdatedAt,
            changeCount + 1
        );
    }
}
