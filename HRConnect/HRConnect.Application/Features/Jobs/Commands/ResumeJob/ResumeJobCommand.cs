using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.ResumeJob;

public sealed class ResumeJobCommand : IRequest<JobActionResponse>
{
    [JsonIgnore] public Guid JobId { get; set; }
    [JsonIgnore] public Guid UserId { get; set; }
    public Guid ConcurrencyToken { get; set; }
}

public sealed class ResumeJobCommandHandler : IRequestHandler<ResumeJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly ICompanyUserRepository _members;
    private readonly IAdminBusinessSettings _settings;
    private readonly IUnitOfWork _uow;

    public ResumeJobCommandHandler(
        IJobRepository jobs,
        ICompanyUserRepository members,
        IAdminBusinessSettings settings,
        IUnitOfWork uow)
        => (_jobs, _members, _settings, _uow) = (jobs, members, settings, uow);

    public async Task<JobActionResponse> Handle(ResumeJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct);
        JobHandlerGuards.RequireStatus(job, JobStatuses.Paused);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);

        if (job.ExpiresAt.HasValue && job.ExpiresAt.Value <= DateTime.UtcNow)
        {
            throw new BadRequestException("Tin tuyển dụng đã hết hạn thời gian hiển thị theo gói. Không thể mở lại tin này, vui lòng tạo tin mới.");
        }

        var serviceTypeCode = job.ServiceType?.Code ?? await _jobs.GetActiveServiceTypeCodeAsync(job.ServiceTypeId, ct);
        if (string.Equals(serviceTypeCode, ServiceTypeCodes.CvApplication, StringComparison.OrdinalIgnoreCase))
        {
            var package = job.PostingPackage ?? (job.PostingPackageId.HasValue ? await _jobs.GetPostingPackageByIdAsync(job.PostingPackageId.Value, ct) : null);
            if (package != null && string.Equals(package.Code, JobPostingPackageCodes.Free, StringComparison.OrdinalIgnoreCase))
            {
                var activeCount = await _jobs.CountActiveJobsByCompanyIdAsync(job.CompanyId, ct);
                var freeLimit = await _settings.GetIntAsync(BusinessSettingKeys.CvApplicationFreeActiveLimit, ct);
                if (activeCount >= freeLimit)
                {
                    throw new BadRequestException(
                        $"Doanh nghiệp đã có {activeCount} tin tuyển dụng đang mở. Gói Miễn Phí (FREE) chỉ cho phép tối đa {freeLimit} tin mở tại một thời điểm.");
                }
            }
        }

        JobTransitions.ChangeStatus(job, JobStatuses.Active, request.UserId, JobReasonCodes.ResumedByClient);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        await _uow.SaveChangesAsync(ct);
        return new(true, "Tiếp tục công việc thành công.", JobDto.From(job));
    }
}

