using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.ServiceAgreements;

public sealed class VoidServiceAgreementCommand : IRequest<ServiceAgreementDto>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid AgreementId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public string VoidReason { get; set; } = null!;
}

public sealed class VoidServiceAgreementCommandHandler : IRequestHandler<VoidServiceAgreementCommand, ServiceAgreementDto>
{
    private readonly IServiceAgreementRepository _agreements;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _uow;
    private readonly IJobRepository? _jobs;
    private readonly INotificationRepository? _notifications;

    public VoidServiceAgreementCommandHandler(
        IServiceAgreementRepository agreements,
        IAuditLogService audit,
        IUnitOfWork uow,
        IJobRepository? jobs = null,
        INotificationRepository? notifications = null)
    {
        _agreements = agreements;
        _audit = audit;
        _uow = uow;
        _jobs = jobs;
        _notifications = notifications;
    }

    public async Task<ServiceAgreementDto> Handle(VoidServiceAgreementCommand request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.VoidReason))
        {
            throw new BadRequestException("Bắt buộc phải cung cấp lý do hủy bỏ thỏa thuận dịch vụ.");
        }

        var agreement = await _agreements.GetByIdForUpdateAsync(request.AgreementId, ct);
        if (agreement == null || agreement.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy thỏa thuận dịch vụ yêu cầu.");
        }

        if (agreement.Status == ServiceAgreementStatuses.Signed)
        {
            throw new ConflictException("Không thể hủy bỏ thỏa thuận dịch vụ đã được ký kết chính thức. Để thay đổi điều khoản, vui lòng tạo phiên bản thỏa thuận bổ sung mới.");
        }

        var now = DateTime.UtcNow;
        var voidReason = request.VoidReason.Trim();
        agreement.Status = ServiceAgreementStatuses.Void;
        agreement.IsCurrent = false;
        agreement.VoidedAt = now;
        agreement.VoidedByUserId = request.UserId;
        agreement.VoidReason = voidReason;
        agreement.ConcurrencyToken = Guid.NewGuid();

        var job = _jobs != null
            ? await _jobs.GetByIdAsync(agreement.JobId, ct)
            : agreement.Job;
        if (job != null)
        {
            if (job.CurrentServiceAgreementId == agreement.ServiceAgreementId
                || job.CurrentServiceAgreement?.ServiceAgreementId == agreement.ServiceAgreementId)
            {
                job.CurrentServiceAgreementId = null;
                job.CurrentServiceAgreement = null;
            }

            job.UpdatedAt = now;
            job.ConcurrencyToken = Guid.NewGuid();

            if (_notifications != null && job.CreatedBy != Guid.Empty)
            {
                await _notifications.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = job.CreatedBy,
                    NotificationType = "JOB",
                    Title = "Thỏa thuận dịch vụ đã bị hủy",
                    Message = $"Dự thảo thỏa thuận dịch vụ (v{agreement.Version}) cho tin tuyển dụng \"{job.Title}\" đã bị hủy bỏ. Lý do: {voidReason}.",
                    RelatedEntityType = "JOB",
                    RelatedEntityId = job.JobId,
                    Metadata = JsonSerializer.Serialize(new
                    {
                        jobId = job.JobId,
                        agreementId = agreement.ServiceAgreementId,
                        version = agreement.Version,
                        reason = voidReason,
                        actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
                    }),
                    IsRead = false,
                    CreatedAt = now
                }, ct);
            }
        }

        await _audit.AddAsync(new AuditEntry
        {
            Action = "SERVICE_AGREEMENT_VOIDED",
            EntityType = "ServiceAgreement",
            EntityId = agreement.ServiceAgreementId,
            ActorUserId = request.UserId,
            NewValues = new { Status = agreement.Status, IsCurrent = agreement.IsCurrent, Reason = agreement.VoidReason, JobId = agreement.JobId }
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return ServiceAgreementDto.FromEntity(agreement);
    }
}
