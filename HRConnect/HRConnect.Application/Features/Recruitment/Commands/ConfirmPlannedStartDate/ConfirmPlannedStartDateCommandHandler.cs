using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmPlannedStartDate;

public class ConfirmPlannedStartDateCommandHandler : IRequestHandler<ConfirmPlannedStartDateCommand, ConfirmPlannedStartDateResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ConfirmPlannedStartDateCommandHandler> _logger;

    public ConfirmPlannedStartDateCommandHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<ConfirmPlannedStartDateCommandHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
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
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền cập nhật ngày nhận việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền cập nhật ngày nhận việc.");
        }

        if (application.Status is "REJECTED" or "WITHDRAWN" or "NOT_STARTED" or "INTERVIEW_FAILED" or "BACKUP_NOT_SELECTED" or "CLOSED")
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể cập nhật ngày nhận việc.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Không thể cập nhật ngày nhận việc cho hồ sơ đang ở trạng thái {application.Status}.");
        }

        var now = DateTime.UtcNow;
        application.PlannedStartDate = request.PlannedStartDate;
        if (!string.IsNullOrWhiteSpace(request.Reason))
        {
            application.StatusReason = request.Reason.Trim();
        }
        application.UpdatedAt = now;
        application.ConcurrencyToken = Guid.NewGuid();

        _applicationRepository.Update(application);
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
