using System.Text.Json.Serialization;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.SubmitJob;

public sealed class SubmitJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } }
public sealed class SubmitJobCommandHandler : IRequestHandler<SubmitJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members; private readonly IUnitOfWork _uow;
    public SubmitJobCommandHandler(IJobRepository jobs, ICompanyUserRepository members, IUnitOfWork uow) => (_jobs, _members, _uow) = (jobs, members, uow);
    public async Task<JobActionResponse> Handle(SubmitJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct);
        JobHandlerGuards.RequireStatus(job, JobStatuses.Draft, JobStatuses.Rejected);
        if (string.IsNullOrWhiteSpace(job.Title) || string.IsNullOrWhiteSpace(job.Description) ||
            !job.JobRequirements.Any(x => x.RequirementType == JobRequirementTypes.MustHave && !string.IsNullOrWhiteSpace(x.Content)))
            throw new BadRequestException("Job phải có tiêu đề, mô tả và ít nhất một yêu cầu MUST_HAVE trước khi gửi duyệt.");
        JobTransitions.ChangeStatus(job, JobStatuses.PendingReview, request.UserId, "Submitted for review");
        _jobs.Update(job); await _uow.SaveChangesAsync(ct);
        return new(true, "Gửi công việc xét duyệt thành công.", JobDto.From(job));
    }
}
