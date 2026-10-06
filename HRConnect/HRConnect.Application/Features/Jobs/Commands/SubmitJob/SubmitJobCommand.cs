using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.SubmitJob;

public sealed class SubmitJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public Guid ConcurrencyToken { get; set; } }
public sealed class SubmitJobCommandHandler : IRequestHandler<SubmitJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members; private readonly IUnitOfWork _uow;
    public SubmitJobCommandHandler(IJobRepository jobs, ICompanyUserRepository members, IUnitOfWork uow) => (_jobs, _members, _uow) = (jobs, members, uow);
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
        JobTransitions.ChangeStatus(job, JobStatuses.PendingReview, request.UserId, JobReasonCodes.SubmittedForReview);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        await _uow.SaveChangesAsync(ct);
        return new(true, "Gửi công việc xét duyệt thành công.", JobDto.From(job, includeStatusHistories: true));
    }
}
