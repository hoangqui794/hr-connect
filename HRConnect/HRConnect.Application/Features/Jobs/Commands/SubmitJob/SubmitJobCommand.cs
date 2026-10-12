using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.SubmitJob;

public sealed class SubmitJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public Guid ConcurrencyToken { get; set; } }
public sealed class SubmitJobCommandHandler : IRequestHandler<SubmitJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _members;
    private readonly IBusinessSettings _businessSettings;
    private readonly IUnitOfWork _uow;

    public SubmitJobCommandHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        IBusinessSettings businessSettings,
        IUnitOfWork uow)
        => (_jobs, _members, _businessSettings, _uow) = (jobs, members, businessSettings, uow);

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
        JobHandlerGuards.RequireVisibilityAllowed(serviceTypeCode, job.Visibility);
        if (job.ApplicationDeadline.HasValue && job.ApplicationDeadline.Value <= DateTime.UtcNow)
            throw new BadRequestException("Hạn nhận hồ sơ của công việc phải lớn hơn thời điểm hiện tại.");

        // Validation & Gán giá trị mặc định theo từng loại dịch vụ (MF-01 B3 & Mục C)
        if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            if (!job.SourcingTarget.HasValue || job.SourcingTarget.Value <= 0)
            {
                throw new BadRequestException("Tin tuyển dụng CV_SOURCING bắt buộc phải có Sourcing Target (số lượng CV đạt chuẩn) lớn hơn 0.");
            }

            if (job.SourcingPricePerCv.HasValue && job.SourcingPricePerCv.Value <= 0)
            {
                throw new BadRequestException("Đơn giá cho mỗi CV đạt chuẩn phải lớn hơn 0.");
            }

            job.SourcingPricePerCv ??= _businessSettings.DefaultSourcingPricePerCv;
            job.FeeMultiplier = null;
            job.WarrantyDays = null;
            job.PaymentDueDays = null;
        }
        else if (string.Equals(serviceTypeCode, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
        {
            if (job.FeeMultiplier.HasValue && job.FeeMultiplier.Value <= 0)
            {
                throw new BadRequestException("Hệ số phí tuyển dụng (Fee Multiplier) phải lớn hơn 0.");
            }

            if (job.WarrantyDays.HasValue && job.WarrantyDays.Value <= 0)
            {
                throw new BadRequestException("Thời gian bảo hành (Warranty Days) phải lớn hơn 0.");
            }

            if (job.PaymentDueDays.HasValue && job.PaymentDueDays.Value <= 0)
            {
                throw new BadRequestException("Hạn thanh toán phí (Payment Due Days) phải lớn hơn 0.");
            }

            job.FeeMultiplier ??= _businessSettings.DefaultHeadhuntFeeMultiplier;
            job.WarrantyDays ??= _businessSettings.DefaultWarrantyDays;
            job.PaymentDueDays ??= _businessSettings.DefaultPaymentDueDays;
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

            // Nếu chưa chọn gói, mặc định chọn gói FREE
            if (package == null)
            {
                package = await _jobs.GetPostingPackageByCodeAsync(JobPostingPackageCodes.Free, ct);
                if (package != null)
                {
                    job.PostingPackageId = package.PackageId;
                    job.PostingPackage = package;
                }
            }

            if (package == null)
            {
                throw new BadRequestException("Không tìm thấy gói đăng tin tuyển dụng hợp lệ.");
            }

            var now = DateTime.UtcNow;

            // Kiểm tra giới hạn gói FREE (B2)
            if (string.Equals(package.Code, JobPostingPackageCodes.Free, StringComparison.OrdinalIgnoreCase))
            {
                // Giới hạn 1: Số tin ACTIVE đồng thời không vượt quá FreeActiveJobLimit
                var activeCount = await _jobs.CountActiveJobsByCompanyIdAsync(job.CompanyId, ct);
                if (activeCount >= _businessSettings.FreeActiveJobLimit)
                {
                    throw new BadRequestException(
                        $"Doanh nghiệp đã có {activeCount} tin tuyển dụng đang mở. Gói Miễn Phí (FREE) chỉ cho phép tối đa {_businessSettings.FreeActiveJobLimit} tin mở tại một thời điểm. Vui lòng đóng tin hiện tại hoặc nâng cấp lên gói Tiêu Chuẩn (STANDARD).");
                }

                // Giới hạn 2: Chu kỳ mở lại FreeCooldownMonths (2 tháng)
                var lastPostedJob = await _jobs.GetLastPostedJobByCompanyIdAsync(job.CompanyId, JobPostingPackageCodes.Free, ct);
                if (lastPostedJob != null && lastPostedJob.JobId != job.JobId && lastPostedJob.PostedAt.HasValue)
                {
                    var nextAllowedDate = lastPostedJob.PostedAt.Value.AddMonths(_businessSettings.FreeCooldownMonths);
                    if (now < nextAllowedDate)
                    {
                        throw new BadRequestException(
                            $"Gói Miễn Phí (FREE) chỉ áp dụng chu kỳ {_businessSettings.FreeCooldownMonths} tháng một lần. Tin tuyển dụng miễn phí gần nhất của bạn đã đăng ngày {lastPostedJob.PostedAt.Value:dd/MM/yyyy}. Bạn có thể đăng tin miễn phí tiếp theo từ ngày {nextAllowedDate:dd/MM/yyyy} hoặc chọn gói Tiêu Chuẩn (STANDARD).");
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
                var existingFee = await _jobs.GetPostingFeeByJobIdAsync(job.JobId, ct);
                if (existingFee == null || existingFee.Status != JobPostingFeeStatuses.Paid)
                {
                    if (existingFee == null)
                    {
                        var standardPrice = package.Price > 0 ? package.Price : _businessSettings.StandardPostingPackagePrice;
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
                        await _uow.SaveChangesAsync(ct);
                    }

                    throw new BadRequestException("Tin tuyển dụng thuộc Gói Tiêu Chuẩn (STANDARD) phải được thanh toán phí đăng tin trước khi gửi duyệt.");
                }
            }
        }
        else
        {
            job.PostingPackageId = null;
            job.ExpiresAt = null;
        }

        JobTransitions.ChangeStatus(job, JobStatuses.PendingReview, request.UserId, JobReasonCodes.SubmittedForReview);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        await _uow.SaveChangesAsync(ct);
        return new(true, "Gửi công việc xét duyệt thành công.", JobDto.From(job, includeStatusHistories: true));
    }
}
