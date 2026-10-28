using System;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.Deposit;

public sealed record ConfirmJobDepositCommand : IRequest<JobDto>
{
    [JsonIgnore]
    public Guid JobId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }
}

public sealed class ConfirmJobDepositCommandHandler : IRequestHandler<ConfirmJobDepositCommand, JobDto>
{
    private readonly IJobRepository _jobRepository;
    private readonly IFinanceRepository _financeRepository;
    private readonly INotificationRepository _notifications;
    private readonly IUnitOfWork _uow;

    public ConfirmJobDepositCommandHandler(
        IJobRepository jobRepository,
        IFinanceRepository financeRepository,
        INotificationRepository notifications,
        IUnitOfWork uow)
    {
        _jobRepository = jobRepository;
        _financeRepository = financeRepository;
        _notifications = notifications;
        _uow = uow;
    }

    public async Task<JobDto> Handle(ConfirmJobDepositCommand request, CancellationToken cancellationToken)
    {
        var job = await _jobRepository.GetByIdAsync(request.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy tin tuyển dụng.");

        if (job.Status != JobStatuses.PendingPayment)
        {
            throw new ConflictException("Chỉ xác nhận cọc cho tin tuyển dụng đang chờ thanh toán (PENDING_PAYMENT).");
        }

        var now = DateTime.UtcNow;

        // Chuyển Job sang ACTIVE
        JobTransitions.ChangeStatus(
            job,
            JobStatuses.Active,
            request.UserId,
            JobReasonCodes.Approved,
            "Đã nhận tiền cọc CV Sourcing. Tin tuyển dụng đã được công bố.");

        await _jobRepository.AddStatusHistoryAsync(job.JobStatusHistories.Last(), cancellationToken);

        job.PostedAt = now;
        job.ClosedAt = null;
        job.StatusReason = null;
        job.UpdatedAt = now;

        // Hoàn tất ServiceAgreement nếu chưa ở SIGNED
        if (job.CurrentServiceAgreement != null && job.CurrentServiceAgreement.Status != ServiceAgreementStatuses.Signed)
        {
            job.CurrentServiceAgreement.Status = ServiceAgreementStatuses.Signed;
            job.CurrentServiceAgreement.SignedAt ??= now;
            job.CurrentServiceAgreement.ConcurrencyToken = Guid.NewGuid();
        }

        // Cập nhật ServiceFee
        var fees = await _financeRepository.GetJobServiceFeesForUpdateAsync(job.JobId, cancellationToken);
        var depositFee = fees.FirstOrDefault(f => f.Kind == ServiceFeeKinds.Deposit && f.Status != ServiceFeeStates.Cancelled);
        if (depositFee != null)
        {
            depositFee.Status = ServiceFeeStates.Paid;
            depositFee.PaidAt = now;
            depositFee.PaymentReference = !string.IsNullOrWhiteSpace(depositFee.PaymentReference)
                ? depositFee.PaymentReference
                : $"DEP-{job.JobId.ToString("N")[..8].ToUpper()}";
            depositFee.RecordedBy = request.UserId;
            depositFee.UpdatedAt = now;
        }

        // Gửi thông báo cho Doanh nghiệp
        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = job.CreatedBy,
            NotificationType = "JOB",
            Title = "Tin tuyển dụng đã được công bố",
            Message = $"HR Connect đã xác nhận nhận tiền cọc cho tin \"{job.Title}\". Tin tuyển dụng đã được kích hoạt công khai.",
            RelatedEntityType = "JOB",
            RelatedEntityId = job.JobId,
            Metadata = JsonSerializer.Serialize(new
            {
                jobId = job.JobId,
                status = JobStatuses.Active,
                actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
            }),
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);

        await _uow.SaveChangesAsync(cancellationToken);
        return JobDto.From(job, isReviewer: true);
    }
}
