using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.SubmitJob;

public sealed class SubmitJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public Guid ConcurrencyToken { get; set; } }
public sealed class SubmitJobCommandHandler : IRequestHandler<SubmitJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _members;
    private readonly IAdminBusinessSettings _settings;
    private readonly IUnitOfWork _uow;
    private readonly IUserRepository? _users;
    private readonly INotificationRepository? _notifications;

    public SubmitJobCommandHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        IAdminBusinessSettings settings,
        IUnitOfWork uow,
        IUserRepository? users = null,
        INotificationRepository? notifications = null)
        => (_jobs, _members, _settings, _uow, _users, _notifications) = (jobs, members, settings, uow, users, notifications);

    public async Task<JobActionResponse> Handle(SubmitJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);
        JobHandlerGuards.RequireStatus(job, JobStatuses.Draft, JobStatuses.Rejected);
        if (string.IsNullOrWhiteSpace(job.Title)) throw new BadRequestException("Tiêu đề công việc là bắt buộc trước khi gửi duyệt.");
        if (string.IsNullOrWhiteSpace(job.Description)) throw new BadRequestException("Mô tả công việc là bắt buộc trước khi gửi duyệt.");
        if (string.IsNullOrWhiteSpace(job.Benefits)) throw new BadRequestException("Quyền lợi công việc là bắt buộc trước khi gửi duyệt.");
        if (string.IsNullOrWhiteSpace(job.Location)) throw new BadRequestException("Địa điểm làm việc là bắt buộc trước khi gửi duyệt.");
        if (string.IsNullOrWhiteSpace(job.EmploymentType)) throw new BadRequestException("Loại hình làm việc là bắt buộc trước khi gửi duyệt.");
        if (job.Quantity < 1) throw new BadRequestException("Số lượng tuyển dụng phải lớn hơn hoặc bằng 1.");
        if (job.SalaryMin.HasValue && job.SalaryMax.HasValue && job.SalaryMin > job.SalaryMax)
            throw new BadRequestException("Mức lương tối thiểu không được lớn hơn mức lương tối đa.");
        if (!job.JobRequirements.Any(x => x.RequirementType == JobRequirementTypes.MustHave && !string.IsNullOrWhiteSpace(x.Content)))
            throw new BadRequestException("Job phải có ít nhất một yêu cầu MUST_HAVE trước khi gửi duyệt.");
        if (job.JobSkills.Count > 0 && !await _jobs.AreSkillsActiveAsync(job.JobSkills.Select(x => x.SkillId).Distinct().ToList(), ct))
            throw new BadRequestException("Một hoặc nhiều kỹ năng không tồn tại hoặc đã ngừng hoạt động.");
        var serviceTypeCode = await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, ct);
        if (serviceTypeCode == null)
            throw new BadRequestException("Loại dịch vụ đã ngừng hoạt động nên Job không thể gửi duyệt.");
        if (job.ApplicationDeadline.HasValue && job.ApplicationDeadline.Value <= DateTime.UtcNow)
            throw new BadRequestException("Hạn nhận hồ sơ của công việc phải lớn hơn thời điểm hiện tại.");

        // Validation theo từng loại dịch vụ (MF-01 A3: Không tự điền giá; giữ null cho tới khi HR duyệt)
        if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            if (!job.SourcingTarget.HasValue || job.SourcingTarget.Value <= 0)
            {
                throw new BadRequestException("INVALID_SOURCING_TARGET", "Tin tuyển dụng CV_SOURCING bắt buộc phải có Sourcing Target (số lượng CV đạt chuẩn) lớn hơn 0.");
            }

            job.FeeMultiplier = null;
            job.WarrantyDays = null;
            job.PaymentDueDays = null;
        }
        else if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            job.SourcingTarget = null;
            job.SourcingPricePerCv = null;
        }
        else if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvApplication, StringComparison.OrdinalIgnoreCase))
        {
            job.SourcingTarget = null;
            job.SourcingPricePerCv = null;
            job.FeeMultiplier = null;
            job.WarrantyDays = null;
            job.PaymentDueDays = null;

            // Xử lý gói đăng tin (MF-01 B1 & B2)
            var package = job.PostingPackage;
            if (package == null && job.PostingPackageId.HasValue)
            {
                package = await _jobs.GetPostingPackageByIdAsync(job.PostingPackageId.Value, ct);
            }

            // Yêu cầu chọn gói rõ ràng cho CV_APPLICATION (bỏ fallback FREE tự động)
            if (package == null)
            {
                throw new BadRequestException("JOB_POSTING_PACKAGE_REQUIRED: Vui lòng chọn gói đăng tin tuyển dụng hợp lệ (FREE hoặc STANDARD) trước khi gửi duyệt.");
            }

            var now = DateTime.UtcNow;
            job.MaxApplications = package.MaxApplications;

            // Kiểm tra giới hạn gói FREE (B2)
            if (string.Equals(package.Code, JobPostingPackageCodes.Free, StringComparison.OrdinalIgnoreCase))
            {
                // Giới hạn 1: Số tin ACTIVE đồng thời không vượt quá FreeActiveJobLimit
                var activeCount = await _jobs.CountActiveJobsByCompanyIdAsync(job.CompanyId, ct);
                var freeLimit = await _settings.GetIntAsync(BusinessSettingKeys.CvApplicationFreeActiveLimit, ct);
                if (activeCount >= freeLimit)
                {
                    throw new BadRequestException(
                        $"Doanh nghiệp đã có {activeCount} tin tuyển dụng đang mở. Gói Miễn Phí (FREE) chỉ cho phép tối đa {freeLimit} tin mở tại một thời điểm. Vui lòng đóng tin hiện tại hoặc nâng cấp lên gói Tiêu Chuẩn (STANDARD).");
                }

                // Giới hạn 2: Chu kỳ mở lại FreeCooldownMonths (2 tháng)
                var lastPostedJob = await _jobs.GetLastPostedJobByCompanyIdAsync(job.CompanyId, JobPostingPackageCodes.Free, ct);
                if (lastPostedJob != null && lastPostedJob.JobId != job.JobId && lastPostedJob.PostedAt.HasValue)
                {
                    var cooldownMonths = await _settings.GetIntAsync(BusinessSettingKeys.CvApplicationFreeCooldownMonths, ct);
                    var nextAllowedDate = lastPostedJob.PostedAt.Value.AddMonths(cooldownMonths);
                    if (now < nextAllowedDate)
                    {
                        throw new BadRequestException(
                            $"Gói Miễn Phí (FREE) chỉ áp dụng chu kỳ {cooldownMonths} tháng một lần. Tin tuyển dụng miễn phí gần nhất của bạn đã đăng ngày {lastPostedJob.PostedAt.Value:dd/MM/yyyy}. Bạn có thể đăng tin miễn phí tiếp theo từ ngày {nextAllowedDate:dd/MM/yyyy} hoặc chọn gói Tiêu Chuẩn (STANDARD).");
                    }
                }

                // Tạo bản ghi phí gói FREE (0 VNĐ, PAID)
                var existingFee = await _jobs.GetPostingFeeByJobIdAsync(job.JobId, ct);
                if (existingFee == null)
                {
                    var freeFee = new JobPostingFee
                    {
                        PostingFeeId = Guid.NewGuid(),
                        JobId = job.JobId,
                        PackageId = package.PackageId,
                        CompanyId = job.CompanyId,
                        Amount = 0m,
                        CurrencyCode = "VND",
                        Status = JobPostingFeeStatuses.Paid,
                        PaidAt = now,
                        PaymentReference = "FREE_TIER",
                        CreatedAt = now,
                        UpdatedAt = now
                    };
                    await _jobs.AddPostingFeeAsync(freeFee, ct);
                }
            }
            else if (string.Equals(package.Code, JobPostingPackageCodes.Standard, StringComparison.OrdinalIgnoreCase))
            {
                // Đảm bảo có bản ghi phí PENDING (Client sẽ thanh toán sau khi Admin duyệt nội dung)
                var existingFee = await _jobs.GetPostingFeeByJobIdAsync(job.JobId, ct);
                if (existingFee == null)
                {
                    var standardPrice = package.Price;
                    existingFee = new JobPostingFee
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
                    await _jobs.AddPostingFeeAsync(existingFee, ct);
                }
            }
        }
        else
        {
            job.PostingPackageId = null;
            job.MaxApplications = null;
            job.ExpiresAt = null;
        }

        JobTransitions.ChangeStatus(job, JobStatuses.PendingReview, request.UserId, JobReasonCodes.SubmittedForReview);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        await NotifyInternalHrAsync(job, ct);
        await _uow.SaveChangesAsync(ct);
        return new(true, "Gửi công việc xét duyệt thành công.", JobDto.From(job, includeStatusHistories: true));
    }

    /// <summary>Every active Internal HR gets a bell notification; it is pushed over SignalR after the commit.</summary>
    private async Task NotifyInternalHrAsync(Job job, CancellationToken ct)
    {
        if (_users == null || _notifications == null) return;
        var hrIds = await _users.GetActiveUserIdsByRoleAsync("INTERNAL_HR", ct);
        var now = DateTime.UtcNow;
        var metadata = System.Text.Json.JsonSerializer.Serialize(new { jobId = job.JobId, status = JobStatuses.PendingReview, routeHint = "/hr/jobs" });
        foreach (var hrId in hrIds)
        {
            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = hrId,
                NotificationType = "JOB",
                Title = "Có tin tuyển dụng mới chờ duyệt",
                Message = $"Tin \"{job.Title}\" vừa được gửi duyệt. Vui lòng kiểm tra nội dung và điều khoản.",
                RelatedEntityType = "JOB",
                RelatedEntityId = job.JobId,
                Metadata = metadata,
                IsRead = false,
                CreatedAt = now,
            }, ct);
        }
    }
}
