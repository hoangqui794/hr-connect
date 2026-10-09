using System.Text.Json.Serialization;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.ApproveJob;

public sealed class ApproveJobCommand : IRequest<JobActionResponse> { [JsonIgnore] public Guid JobId { get; set; } [JsonIgnore] public Guid UserId { get; set; } public Guid ConcurrencyToken { get; set; } }
public sealed class ApproveJobCommandHandler : IRequestHandler<ApproveJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs;
    private readonly INotificationRepository _notifications;
    private readonly IUnitOfWork _uow;

    public ApproveJobCommandHandler(IJobRepository jobs, INotificationRepository notifications, IUnitOfWork uow)
        => (_jobs, _notifications, _uow) = (jobs, notifications, uow);

    public async Task<JobActionResponse> Handle(ApproveJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetJobAsync(_jobs, request.JobId, ct);
        JobTransitions.RequireCurrentToken(job, request.ConcurrencyToken);
        JobHandlerGuards.RequireStatus(job, JobStatuses.PendingReview);
        JobTransitions.ChangeStatus(job, JobStatuses.Active, request.UserId, JobReasonCodes.Approved);
        await _jobs.AddStatusHistoryAsync(job.JobStatusHistories.Last(), ct);
        job.PostedAt = DateTime.UtcNow; job.ClosedAt = null;

        await _notifications.AddAsync(new HRConnect.Domain.Entities.Notification
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
                actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
            }),
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        }, ct);

        await _uow.SaveChangesAsync(ct);
        return new(true, "Duyệt và công bố công việc thành công.", JobDto.From(job));
    }
}
