using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
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

    public ConfirmPlannedStartDateCommandHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<ConfirmPlannedStartDateCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
    }

    public async Task<ConfirmPlannedStartDateResponse> Handle(ConfirmPlannedStartDateCommand request, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
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

        if (request.ConcurrencyToken.HasValue && request.ConcurrencyToken.Value != application.ConcurrencyToken)
        {
            _logger.LogWarning("Xung đột phiên bản cho hồ sơ {ApplicationId}.", request.ApplicationId);
            throw new ConflictException("Dữ liệu hồ sơ đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
        }

        if (application.Status != ApplicationStates.OfferAccepted)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể cập nhật ngày nhận việc.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Chỉ có thể cập nhật ngày nhận việc sau khi ứng viên chấp nhận offer ({ApplicationStates.OfferAccepted}). Trạng thái hiện tại: {application.Status}.");
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

        var now = DateTime.UtcNow;
        var oldPlannedStartDate = application.PlannedStartDate;
        application.PlannedStartDate = request.PlannedStartDate;
        if (!string.IsNullOrWhiteSpace(request.Reason))
        {
            application.StatusReason = request.Reason.Trim();
        }
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
            NewValues = new { plannedStartDate = application.PlannedStartDate, status = application.Status, hasReason = !string.IsNullOrWhiteSpace(request.Reason) }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã cập nhật ngày nhận việc cho hồ sơ {ApplicationId} thành {PlannedStartDate}.",
            application.ApplicationId, request.PlannedStartDate);

        return new ConfirmPlannedStartDateResponse(
            application.ApplicationId,
            application.PlannedStartDate.Value,
            application.Status,
            application.StatusReason,
            application.ConcurrencyToken,
            application.UpdatedAt
        );
    }
}
