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

public sealed record NotifyJobDepositCommand : IRequest<bool>
{
    [JsonIgnore]
    public Guid JobId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }

    public string? PaymentReference { get; set; }
}

public sealed class NotifyJobDepositCommandHandler : IRequestHandler<NotifyJobDepositCommand, bool>
{
    private readonly IJobRepository _jobRepository;
    private readonly IUserRepository _users;
    private readonly INotificationRepository _notifications;
    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _uow;

    public NotifyJobDepositCommandHandler(
        IJobRepository jobRepository,
        IUserRepository users,
        INotificationRepository notifications,
        IFinanceRepository financeRepository,
        IUnitOfWork uow)
    {
        _jobRepository = jobRepository;
        _users = users;
        _notifications = notifications;
        _financeRepository = financeRepository;
        _uow = uow;
    }

    public async Task<bool> Handle(NotifyJobDepositCommand request, CancellationToken cancellationToken)
    {
        var job = await _jobRepository.GetByIdAsync(request.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy tin tuyển dụng.");

        if (job.Status != JobStatuses.PendingPayment)
        {
            throw new ConflictException("Tin tuyển dụng hiện không ở trạng thái chờ nộp cọc / thanh toán.");
        }

        var now = DateTime.UtcNow;
        var reference = string.IsNullOrWhiteSpace(request.PaymentReference)
            ? $"DEP-{job.JobId.ToString("N")[..8].ToUpper()}"
            : request.PaymentReference.Trim();

        job.StatusReason = "DEPOSIT_SUBMITTED";
        job.UpdatedAt = now;

        // Cập nhật ServiceFee (Kind == DEPOSIT) nếu đã tồn tại
        var fees = await _financeRepository.GetJobServiceFeesForUpdateAsync(job.JobId, cancellationToken);
        var depositFee = fees.FirstOrDefault(f => f.Kind == ServiceFeeKinds.Deposit && f.Status != ServiceFeeStates.Cancelled);
        if (depositFee != null)
        {
            depositFee.PaymentReference = reference;
            depositFee.UpdatedAt = now;
        }

        // Ghi lại lịch sử trạng thái
        var history = new JobStatusHistory
        {
            JobStatusHistoryId = Guid.NewGuid(),
            JobId = job.JobId,
            OldStatus = JobStatuses.PendingPayment,
            NewStatus = JobStatuses.PendingPayment,
            ChangedBy = request.UserId,
            ReasonCode = "DEPOSIT_SUBMITTED",
            ReasonText = $"Doanh nghiệp đã nộp cọc (mã tham chiếu: {reference}). Đang chờ HR Connect xác nhận.",
            ChangedAt = now
        };
        await _jobRepository.AddStatusHistoryAsync(history, cancellationToken);

        // Tạo thông báo cho toàn bộ nhân sự Internal HR
        var hrIds = await _users.GetActiveUserIdsByRoleAsync("INTERNAL_HR", cancellationToken);
        var hrMetadata = JsonSerializer.Serialize(new
        {
            jobId = job.JobId,
            status = JobStatuses.PendingPayment,
            routeHint = $"/hr/jobs?status=PENDING_PAYMENT&highlight={job.JobId}"
        });

        foreach (var hrId in hrIds)
        {
            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = hrId,
                NotificationType = "JOB",
                Title = "Doanh nghiệp đã nộp tiền cọc",
                Message = $"Doanh nghiệp {job.Company?.CompanyName ?? "khách hàng"} đã nộp tiền cọc cho tin \"{job.Title}\". Vui lòng kiểm tra và xác nhận công khai tin.",
                RelatedEntityType = "JOB",
                RelatedEntityId = job.JobId,
                Metadata = hrMetadata,
                IsRead = false,
                CreatedAt = now
            }, cancellationToken);
        }

        // Tạo thông báo xác nhận gửi cho Doanh nghiệp
        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = job.CreatedBy,
            NotificationType = "JOB",
            Title = "Đã xác nhận nộp tiền cọc",
            Message = $"Hệ thống đã ghi nhận khoản nộp cọc cho tin \"{job.Title}\". HR Connect đang đối soát và sẽ kích hoạt công khai tin.",
            RelatedEntityType = "JOB",
            RelatedEntityId = job.JobId,
            Metadata = JsonSerializer.Serialize(new
            {
                jobId = job.JobId,
                status = JobStatuses.PendingPayment,
                actionRoute = $"/client/agreements?jobId={job.JobId}"
            }),
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);

        await _uow.SaveChangesAsync(cancellationToken);
        return true;
    }
}
