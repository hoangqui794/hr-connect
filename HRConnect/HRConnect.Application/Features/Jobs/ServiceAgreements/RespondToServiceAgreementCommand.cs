using System;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class RespondToServiceAgreementCommand : IRequest<ServiceAgreementDto>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid AgreementId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public Guid ConcurrencyToken { get; set; }
    public string Action { get; set; } = null!; // ACCEPT or REQUEST_CHANGES
    public string? ChangeRequestReason { get; set; }
}

public sealed class RespondToServiceAgreementCommandHandler : IRequestHandler<RespondToServiceAgreementCommand, ServiceAgreementDto>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _companyUsers;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _uow;

    public RespondToServiceAgreementCommandHandler(
        IServiceAgreementRepository agreements,
        IJobRepository jobs,
        ICompanyUserRepository companyUsers,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork uow)
    {
        _agreements = agreements;
        _jobs = jobs;
        _companyUsers = companyUsers;
        _notifications = notifications;
        _audit = audit;
        _uow = uow;
    }

    public async Task<ServiceAgreementDto> Handle(RespondToServiceAgreementCommand request, CancellationToken ct)
    {
        var agreement = await _agreements.GetByIdForUpdateAsync(request.AgreementId, ct);
        if (agreement == null || agreement.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
        }

        var job = await _jobs.GetByIdAsync(agreement.JobId, ct);
        if (job == null)
        {
            throw new NotFoundException("Không tìm thấy tin tuyển dụng liên quan.");
        }

        if (agreement.ConcurrencyToken != request.ConcurrencyToken)
        {
            throw new ConflictException("Thỏa thuận dịch vụ đã được cập nhật bởi một thao tác khác. Vui lòng tải lại trang.");
        }

        if (!agreement.IsCurrent || agreement.Status != ServiceAgreementStatuses.SentToClient)
        {
            throw new ConflictException($"Không thể phản hồi thỏa thuận dịch vụ đang ở trạng thái {agreement.Status}.");
        }

        // Validate user belongs to the company
        var companyUser = await _companyUsers.GetByUserIdAsync(request.UserId, ct);
        if (companyUser == null || companyUser.CompanyId != agreement.CompanyId || companyUser.Status != "ACTIVE")
        {
            throw new ForbiddenException("Bạn không có quyền phản hồi thỏa thuận dịch vụ cho doanh nghiệp này.");
        }

        var normalizedAction = request.Action?.Trim().ToUpperInvariant();
        var now = DateTime.UtcNow;

        if (normalizedAction == ServiceAgreementResponseActions.Accept)
        {
            agreement.Status = ServiceAgreementStatuses.Accepted;
            agreement.RespondedAt = now;
            agreement.ChangeRequestReason = null;
            agreement.ConcurrencyToken = Guid.NewGuid();

            // Notify HR creator
            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = agreement.CreatedByUserId,
                Title = "Client đã đồng ý thỏa thuận dịch vụ",
                Message = $"Doanh nghiệp '{agreement.CompanyNameSnapshot}' đã chấp thuận dự thảo thỏa thuận (v{agreement.Version}). Đang chờ người đại diện ký điện tử.",
                NotificationType = "JOB",
                RelatedEntityType = "SERVICE_AGREEMENT",
                RelatedEntityId = agreement.ServiceAgreementId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new { agreementId = agreement.ServiceAgreementId, status = agreement.Status }),
                CreatedAt = now
            }, ct);

            await _audit.AddAsync(new AuditEntry
            {
                Action = "SERVICE_AGREEMENT_ACCEPTED",
                EntityType = "ServiceAgreement",
                EntityId = agreement.ServiceAgreementId,
                ActorUserId = request.UserId,
                NewValues = new { Status = agreement.Status, Version = agreement.Version }
            }, ct);
        }
        else if (normalizedAction == ServiceAgreementResponseActions.RequestChanges)
        {
            if (string.IsNullOrWhiteSpace(request.ChangeRequestReason))
            {
                throw new BadRequestException("Bắt buộc phải cung cấp lý do/yêu cầu điều chỉnh khi yêu cầu thay đổi thỏa thuận.");
            }

            agreement.Status = ServiceAgreementStatuses.ChangeRequested;
            agreement.RespondedAt = now;
            agreement.ChangeRequestReason = request.ChangeRequestReason.Trim();
            agreement.ConcurrencyToken = Guid.NewGuid();

            job.CurrentServiceAgreementId = agreement.ServiceAgreementId;
            job.UpdatedAt = now;
            job.ConcurrencyToken = Guid.NewGuid();

            job.JobStatusHistories.Add(new JobStatusHistory
            {
                JobStatusHistoryId = Guid.NewGuid(),
                JobId = job.JobId,
                OldStatus = job.Status,
                NewStatus = job.Status,
                ChangedBy = request.UserId,
                ReasonCode = JobReasonCodes.AgreementChangesRequested,
                ReasonText = $"Client yêu cầu điều chỉnh thỏa thuận v{agreement.Version}: {agreement.ChangeRequestReason}",
                ChangedAt = now
            });

            // Notify HR creator
            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = agreement.CreatedByUserId,
                Title = "Client yêu cầu điều chỉnh thỏa thuận dịch vụ",
                Message = $"Doanh nghiệp '{agreement.CompanyNameSnapshot}' đã yêu cầu điều chỉnh thỏa thuận (v{agreement.Version}): {agreement.ChangeRequestReason}",
                NotificationType = "JOB",
                RelatedEntityType = "SERVICE_AGREEMENT",
                RelatedEntityId = agreement.ServiceAgreementId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new { agreementId = agreement.ServiceAgreementId, status = agreement.Status }),
                CreatedAt = now
            }, ct);

            await _audit.AddAsync(new AuditEntry
            {
                Action = "SERVICE_AGREEMENT_CHANGE_REQUESTED",
                EntityType = "ServiceAgreement",
                EntityId = agreement.ServiceAgreementId,
                ActorUserId = request.UserId,
                NewValues = new { Status = agreement.Status, Reason = agreement.ChangeRequestReason }
            }, ct);
        }
        else
        {
            throw new BadRequestException($"Hành động không hợp lệ: {request.Action}. Hỗ trợ: ACCEPT hoặc REQUEST_CHANGES.");
        }

        await _uow.SaveChangesAsync(ct);
        return ServiceAgreementDto.FromEntity(agreement);
    }
}
