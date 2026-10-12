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

            var fee = await _jobs.GetPostingFeeByJobIdAsync(job.JobId, ct);

            if (package != null && string.Equals(package.Code, JobPostingPackageCodes.Standard, StringComparison.OrdinalIgnoreCase))
            {
                var standardPrice = package.Price > 0 ? package.Price : _businessSettings.StandardPostingPackagePrice;

                // Nếu chưa thanh toán và có mã tham chiếu thanh toán từ Admin -> tự động ghi nhận thanh toán
                if (fee != null && fee.Status != JobPostingFeeStatuses.Paid)
                {
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
                        throw new BadRequestException(
                            $"Tin tuyển dụng gói Tiêu Chuẩn (STANDARD) chưa thanh toán phí đăng tin ({standardPrice:N0} đ). Vui lòng ghi nhận thanh toán trước khi duyệt công bố.");
                    }
                }
            }

            var duration = package?.DurationDays > 0 ? package.DurationDays : _businessSettings.StandardPostingDurationDays;
            job.ExpiresAt = now.AddDays(duration);

            if (fee != null)
            {
                fee.ActivatedAt = now;
                fee.ExpiresAt = job.ExpiresAt;
                fee.UpdatedAt = now;
            }
        }

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
