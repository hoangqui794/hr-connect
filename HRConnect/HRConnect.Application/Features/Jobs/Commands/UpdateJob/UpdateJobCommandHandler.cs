using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Commands.UpdateJob;

public sealed class UpdateJobCommandHandler : IRequestHandler<UpdateJobCommand, JobActionResponse>
{
    private readonly IJobRepository _jobs; private readonly ICompanyUserRepository _members; private readonly IUnitOfWork _uow;
    public UpdateJobCommandHandler(IJobRepository jobs, ICompanyUserRepository members, IUnitOfWork uow) => (_jobs, _members, _uow) = (jobs, members, uow);

    public async Task<JobActionResponse> Handle(UpdateJobCommand request, CancellationToken ct)
    {
        var job = await JobHandlerGuards.GetOwnedJobAsync(_jobs, _members, request.JobId, request.UserId, ct);
        JobHandlerGuards.RequireStatus(job, JobStatuses.Draft, JobStatuses.Rejected);
        if (!await _jobs.IsServiceTypeActiveAsync(request.ServiceTypeId, ct))
            throw new BadRequestException("Loại dịch vụ không tồn tại hoặc đã ngừng hoạt động.");
        var now = DateTime.UtcNow;
        job.ServiceTypeId = request.ServiceTypeId; job.Title = request.Title?.Trim() ?? string.Empty;
        job.Description = Normalize(request.Description); job.Location = Normalize(request.Location);
        job.EmploymentType = Normalize(request.EmploymentType)?.ToUpperInvariant();
        job.SalaryMin = request.SalaryMin; job.SalaryMax = request.SalaryMax;
        job.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant(); job.Quantity = request.Quantity;
        job.Visibility = request.Visibility.Trim().ToUpperInvariant(); job.UpdatedAt = now; job.StatusReason = null;
        job.JobRequirements.Clear();
        foreach (var item in request.Requirements)
            job.JobRequirements.Add(new JobRequirement { RequirementId = Guid.NewGuid(), JobId = job.JobId,
                RequirementType = item.RequirementType.Trim().ToUpperInvariant(), Category = Normalize(item.Category),
                Content = item.Content.Trim(), Weight = item.Weight, CreatedAt = now, UpdatedAt = now });
        _jobs.Update(job); await _uow.SaveChangesAsync(ct);
        return new(true, "Cập nhật công việc thành công.", JobDto.From(job));
    }
    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
