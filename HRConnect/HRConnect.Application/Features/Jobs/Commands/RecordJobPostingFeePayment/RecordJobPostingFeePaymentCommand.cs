using System;
using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.RecordJobPostingFeePayment;

public sealed record RecordJobPostingFeePaymentCommand : IRequest<JobPostingFeeDto>
{
    [JsonIgnore]
    public Guid JobId { get; set; }

    [JsonIgnore]
    public Guid UserId { get; set; }

    public string PaymentReference { get; set; } = null!;

    public DateTime? PaidAt { get; set; }
}

public sealed class RecordJobPostingFeePaymentCommandHandler : IRequestHandler<RecordJobPostingFeePaymentCommand, JobPostingFeeDto>
{
    private readonly IJobRepository _jobRepository;
    private readonly IBusinessSettings _businessSettings;
    private readonly INotificationRepository _notifications;
    private readonly IUnitOfWork _uow;

    public RecordJobPostingFeePaymentCommandHandler(
        IJobRepository jobRepository,
        IBusinessSettings businessSettings,
        INotificationRepository notifications,
        IUnitOfWork uow)
    {
        _jobRepository = jobRepository;
        _businessSettings = businessSettings;
        _notifications = notifications;
        _uow = uow;
    }

    public async Task<JobPostingFeeDto> Handle(RecordJobPostingFeePaymentCommand request, CancellationToken cancellationToken)
    {
        var job = await _jobRepository.GetByIdAsync(request.JobId, cancellationToken);
        if (job == null)
        {
            throw new NotFoundException("Không tìm thấy tin tuyển dụng.");
        }

        var fee = await _jobRepository.GetPostingFeeByJobIdAsync(request.JobId, cancellationToken);
        var now = DateTime.UtcNow;
        if (fee == null)
        {
            var package = job.PostingPackage;
            if (package == null && job.PostingPackageId.HasValue)
            {
                package = await _jobRepository.GetPostingPackageByIdAsync(job.PostingPackageId.Value, cancellationToken);
            }
            if (package == null)
            {
                package = await _jobRepository.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Standard, cancellationToken);
            }

            if (package == null)
            {
                throw new NotFoundException("Tin tuyển dụng chưa có gói đăng tin hợp lệ.");
            }

            fee = new JobPostingFee
            {
                PostingFeeId = Guid.NewGuid(),
                JobId = job.JobId,
                PackageId = package.PackageId,
                CompanyId = job.CompanyId,
                Amount = package.Price > 0 ? package.Price : _businessSettings.StandardPostingPackagePrice,
                CurrencyCode = "VND",
                Status = JobPostingFeeStatuses.Pending,
                CreatedAt = now,
                UpdatedAt = now,
                Package = package
            };
            await _jobRepository.AddPostingFeeAsync(fee, cancellationToken);
        }

        if (fee.Status == JobPostingFeeStatuses.Paid)
        {
            throw new BadRequestException("Phí đăng tin này đã được thanh toán trước đó.");
        }

        fee.Status = JobPostingFeeStatuses.Paid;
        fee.PaidAt = request.PaidAt ?? now;
        fee.PaymentReference = request.PaymentReference;
        fee.RecordedBy = request.UserId;
        fee.UpdatedAt = now;

        var duration = fee.Package?.DurationDays ?? _businessSettings.StandardPostingDurationDays;
        fee.ActivatedAt = now;
        fee.ExpiresAt = now.AddDays(duration);

        // Kích hoạt ngày hết hạn trên Job
        job.ExpiresAt = fee.ExpiresAt;

        var becameActive = false;
        if (job.Status == JobStatuses.PendingPayment)
        {
            JobTransitions.ChangeStatus(
                job,
                JobStatuses.Active,
                request.UserId,
                JobReasonCodes.Approved,
                "Đã thanh toán phí sử dụng nền tảng thành công. Tin tuyển dụng đã được công bố.");
            await _jobRepository.AddStatusHistoryAsync(job.JobStatusHistories.Last(), cancellationToken);
            job.PostedAt = now;
            job.ClosedAt = null;
            becameActive = true;
        }

        _jobRepository.Update(job);

        // Gửi thông báo cho Client
        var notificationTitle = becameActive
            ? "Tin tuyển dụng đã được kích hoạt và công bố"
            : "Phí đăng tin đã được ghi nhận thanh toán";
        var notificationMessage = becameActive
            ? $"Tin tuyển dụng \"{job.Title}\" đã được thanh toán và công bố công khai (Hạn hiển thị: {fee.ExpiresAt:dd/MM/yyyy})."
            : $"Gói đăng tin cho tin \"{job.Title}\" đã được kích hoạt thành công (Hạn hiển thị: {fee.ExpiresAt:dd/MM/yyyy}).";

        await _notifications.AddAsync(new Domain.Entities.Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = job.CreatedBy,
            NotificationType = "JOB",
            Title = notificationTitle,
            Message = notificationMessage,
            RelatedEntityType = "JOB",
            RelatedEntityId = job.JobId,
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                jobId = job.JobId,
                status = job.Status,
                expiresAt = fee.ExpiresAt,
                actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
            }),
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);

        await _uow.SaveChangesAsync(cancellationToken);

        return new JobPostingFeeDto(
            fee.PostingFeeId,
            fee.JobId,
            fee.PackageId,
            fee.Package?.Code,
            fee.Package?.Name,
            fee.Amount,
            fee.CurrencyCode,
            fee.Status,
            fee.PaidAt,
            fee.PaymentReference,
            fee.ActivatedAt,
            fee.ExpiresAt,
            fee.CreatedAt);
    }
}
