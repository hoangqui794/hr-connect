using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.DecideBackupApplication;

public class DecideBackupApplicationCommandHandler : IRequestHandler<DecideBackupApplicationCommand, DecideBackupApplicationResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DecideBackupApplicationCommandHandler> _logger;

    public DecideBackupApplicationCommandHandler(
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<DecideBackupApplicationCommandHandler> logger)
    {
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<DecideBackupApplicationResponse> Handle(DecideBackupApplicationCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Decision))
        {
            throw new BadRequestException("Quyết định xử lý ứng viên dự phòng không được để trống.");
        }

        var normalizedDecision = request.Decision.Trim().ToUpperInvariant();
        string targetStatus;
        string defaultReason;

        switch (normalizedDecision)
        {
            case "SELECT":
            case "ACTIVATE":
            case "CHOOSE":
            case "SHORTLIST":
                normalizedDecision = "SELECT";
                targetStatus = "INTERVIEW";
                defaultReason = "Được chọn từ danh sách dự phòng (Backup candidate selected).";
                break;
            case "REJECT":
            case "NOT_SELECTED":
            case "REJECTED":
            case "DECLINE":
                normalizedDecision = "REJECT";
                targetStatus = "BACKUP_NOT_SELECTED";
                defaultReason = "Không được chọn từ danh sách dự phòng (Backup candidate not selected).";
                break;
            case "KEEP_ON_HOLD":
            case "HOLD":
                normalizedDecision = "KEEP_ON_HOLD";
                targetStatus = "BACKUP";
                defaultReason = "Tiếp tục lưu giữ hồ sơ dự phòng (Kept on hold as backup).";
                break;
            default:
                throw new BadRequestException($"Quyết định '{request.Decision}' không hợp lệ. Các quyết định được hỗ trợ: SELECT, REJECT, KEEP_ON_HOLD.");
        }

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển {ApplicationId}.", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");
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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố quyết định hồ sơ dự phòng cho job của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, application.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền quyết định hồ sơ dự phòng cho doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền quyết định ứng viên dự phòng.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền quyết định ứng viên dự phòng.");
        }

        var isBackup = string.Equals(application.Status, "BACKUP", StringComparison.OrdinalIgnoreCase)
            || (application.Interviews?.Any(i => string.Equals(i.Result, "BACKUP", StringComparison.OrdinalIgnoreCase)) == true);

        if (!isBackup)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không phải là ứng viên dự phòng.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Hồ sơ ứng tuyển đang ở trạng thái {application.Status}, không phải là hồ sơ dự phòng (BACKUP).");
        }

        if (request.ConcurrencyToken.HasValue &&
            application.ConcurrencyToken != Guid.Empty &&
            request.ConcurrencyToken.Value != application.ConcurrencyToken)
        {
            _logger.LogWarning("Xung đột phiên bản cho hồ sơ {ApplicationId}. Token gửi lên: {ClientToken}, Token hiện tại: {DbToken}.",
                application.ApplicationId, request.ConcurrencyToken.Value, application.ConcurrencyToken);
            throw new ConflictException("Dữ liệu hồ sơ ứng tuyển đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = application.Status;
        var newConcurrencyToken = Guid.NewGuid();

        application.Status = targetStatus;
        application.StatusReason = request.Reason ?? request.Note ?? defaultReason;
        application.UpdatedAt = now;
        application.ConcurrencyToken = newConcurrencyToken;

        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = oldStatus,
            NewStatus = targetStatus,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = request.Reason ?? request.Note ?? defaultReason
        });

        _applicationRepository.Update(application);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new DecideBackupApplicationResponse
        {
            Success = true,
            Message = "Quyết định xử lý ứng viên dự phòng thành công.",
            Data = new DecideBackupApplicationData
            {
                ApplicationId = application.ApplicationId,
                PreviousStatus = oldStatus,
                CurrentStatus = targetStatus,
                Decision = normalizedDecision,
                Reason = request.Reason,
                Note = request.Note,
                DecidedBy = request.CurrentUserId,
                DecidedAt = now,
                ConcurrencyToken = newConcurrencyToken
            }
        };
    }
}
