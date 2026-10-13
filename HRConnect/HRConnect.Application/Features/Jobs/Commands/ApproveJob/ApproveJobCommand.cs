using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.ApproveJob;

public sealed class ApproveJobCommand : IRequest<JobActionResponse>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public Guid ConcurrencyToken { get; set; }
    public string? PaymentReference { get; set; }
}

public sealed class ApproveJobCommandHandler : IRequestHandler<ApproveJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly IBusinessSettings _businessSettings;
    private readonly INotificationRepository _notifications;
    private readonly IUnitOfWork _uow;

    public ApproveJobCommandHandler(
        IJobRepository jobs,
        IBusinessSettings businessSettings,
        INotificationRepository notifications,
        IUnitOfWork uow)
        => (_jobs, _businessSettings, _notifications, _uow) = (jobs, businessSettings, notifications, uow);

    public async Task<JobActionResponse> Handle(ApproveJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);
        JobHandlerGuards.RequireStatus(job, JobStatuses.PendingReview);

        var serviceTypeCode = job.ServiceType?.Code ?? await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, ct);
        var now = DateTime.UtcNow;
        var requiresPayment = false;
        decimal standardPrice = 0m;

        if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvApplication, StringComparison.OrdinalIgnoreCase))
        {
            var package = job.PostingPackage;
            if (package == null && job.PostingPackageId.HasValue)
            {
                package = await _jobs.GetPostingPackageByIdAsync(job.PostingPackageId.Value, ct);
            }

            if (package == null)
            {
                package = await _jobs.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, ct);
                if (package != null)
                {
                    job.PostingPackageId = package.PackageId;
                    job.PostingPackage = package;
                }
            }

            job.MaxApplications = package?.MaxApplications;
            var fee = await _jobs.GetPostingFeeByJobIdAsync(job.JobId, ct);

            if (package != null && string.Equals(package.Code, JobPostingPackageCodes.Standard, StringComparison.OrdinalIgnoreCase))
            {
                standardPrice = package.Price > 0 ? package.Price : _businessSettings.StandardPostingPackagePrice;

                if (fee == null)
                {
                    fee = new JobPostingFee
                    {
                        PostingFeeId = Guid.NewGuid(),
                        JobId = job.JobId,
                        PackageId = package.PackageId,
                        CompanyId = job.CompanyId,
                        Amount = standardPrice,
                        CurrencyCode = "VND",
                        Status = JobPostingFeeStatuses.Pending,
                        CreatedAt = now,
                        UpdatedAt = now
                    };
                    await _jobs.AddPostingFeeAsync(fee, ct);
                }

                if (fee.Status != JobPostingFeeStatuses.Paid)
                {
                    // Nếu Admin cung cấp mã thanh toán tại thời điểm duyệt -> ghi nhận thanh toán luôn và công bố
                    if (!string.IsNullOrWhiteSpace(request.PaymentReference))
                    {
                        fee.Status = JobPostingFeeStatuses.Paid;
                        fee.PaidAt = now;
                        fee.PaymentReference = request.PaymentReference.Trim();
                        fee.RecordedBy = request.UserId;
                        fee.UpdatedAt = now;
                    }
                    else
                    {
                        // Luồng chuẩn: Duyệt nội dung trước, chuyển sang PENDING_PAYMENT để Client thanh toán sau
                        requiresPayment = true;
                    }
                }
            }

            var duration = package?.DurationDays > 0 ? package.DurationDays : _businessSettings.StandardPostingDurationDays;

            if (!requiresPayment)
            {
                job.ExpiresAt = now.AddDays(duration);
                if (fee != null)
                {
                    fee.ActivatedAt = now;
                    fee.ExpiresAt = job.ExpiresAt;
                    fee.UpdatedAt = now;
                }
            }
        }

        if (requiresPayment)
        {
            // Chuyển sang Chờ thanh toán
            JobTransitions.ChangeStatus(
                job,
                JobStatuses.PendingPayment,
                request.UserId,
                JobReasonCodes.Approved,
                "Nội dung tin tuyển dụng đã được duyệt. Vui lòng thanh toán phí dịch vụ để công bố.");
            await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);

            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = job.CreatedBy,
                NotificationType = "JOB",
                Title = "Tin tuyển dụng đã được duyệt nội dung",
                Message = $"Tin tuyển dụng \"{job.Title}\" đã được phê duyệt nội dung. Vui lòng thanh toán phí đăng tin ({standardPrice:N0} đ) để công bố.",
                RelatedEntityType = "JOB",
                RelatedEntityId = job.JobId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    jobId = job.JobId,
                    status = JobStatuses.PendingPayment,
                    amount = standardPrice,
                    actionRoute = $"/client/jobs?highlight={job.JobId}&openPayment=true"
                }),
                IsRead = false,
                CreatedAt = now
            }, ct);

            await _uow.SaveChangesAsync(ct);
            return new(true, "Duyệt nội dung thành công. Tin tuyển dụng đã chuyển sang trạng thái Chờ thanh toán.", JobDto.From(job));
        }

        // Trường hợp miễn phí hoặc đã thanh toán: Kích hoạt ACTIVE ngay
        JobTransitions.ChangeStatus(job, JobStatuses.Active, request.UserId, JobReasonCodes.Approved);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        job.PostedAt = now;
        job.ClosedAt = null;

        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = job.CreatedBy,
            NotificationType = "JOB",
            Title = "Tin tuyển dụng đã được duyệt",
            Message = $"Tin tuyển dụng \"{job.Title}\" đã được phê duyệt và công bố.",
            RelatedEntityType = "JOB",
            RelatedEntityId = job.JobId,
            Metadata = System.Text.Json.JsonSerializer.Serialize(new
            {
                jobId = job.JobId,
                status = JobStatuses.Active,
                expiresAt = job.ExpiresAt,
                actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
            }),
            IsRead = false,
            CreatedAt = now
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return new(true, "Duyệt và công bố công việc thành công.", JobDto.From(job));
    }
}
