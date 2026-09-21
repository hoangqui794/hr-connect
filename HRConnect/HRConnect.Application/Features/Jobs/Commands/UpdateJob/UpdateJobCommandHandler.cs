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
        var skillIds = request.Skills.Select(x => x.SkillId).Distinct().ToList();
        if (skillIds.Count > 0 && !await _jobs.AreSkillsActiveAsync(skillIds, ct))
            throw new BadRequestException("Một hoặc nhiều kỹ năng không tồn tại hoặc đã ngừng hoạt động.");
        var now = DateTime.UtcNow;
        job.ServiceTypeId = request.ServiceTypeId; job.Title = request.Title?.Trim() ?? string.Empty;
        job.Description = Normalize(request.Description); job.Location = Normalize(request.Location);
        job.EmploymentType = Normalize(request.EmploymentType)?.ToUpperInvariant();
        job.SalaryMin = request.SalaryMin; job.SalaryMax = request.SalaryMax;
        job.CurrencyCode = request.CurrencyCode.Trim().ToUpperInvariant(); job.Quantity = request.Quantity;
        job.Visibility = request.Visibility.Trim().ToUpperInvariant(); job.UpdatedAt = now; job.StatusReason = null;
        var existingRequirements = job.JobRequirements.OrderBy(item => item.CreatedAt).ToList();
        for (var index = 0; index < request.Requirements.Count; index++)
        {
            var item = request.Requirements[index];
            if (index < existingRequirements.Count)
            {
                var existing = existingRequirements[index];
                existing.RequirementType = item.RequirementType.Trim().ToUpperInvariant();
                existing.Category = Normalize(item.Category);
                existing.Content = item.Content.Trim();
                existing.Weight = item.Weight;
                existing.UpdatedAt = now;
                continue;
            }

            job.JobRequirements.Add(new JobRequirement
            {
                RequirementId = Guid.NewGuid(),
                JobId = job.JobId,
                RequirementType = item.RequirementType.Trim().ToUpperInvariant(),
                Category = Normalize(item.Category),
                Content = item.Content.Trim(),
                Weight = item.Weight,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        foreach (var removedRequirement in existingRequirements.Skip(request.Requirements.Count))
            job.JobRequirements.Remove(removedRequirement);
        var requestedSkills = request.Skills.ToDictionary(item => item.SkillId);
        var removedSkills = job.JobSkills
            .Where(existing => !requestedSkills.ContainsKey(existing.SkillId))
            .ToList();
        foreach (var removedSkill in removedSkills)
            job.JobSkills.Remove(removedSkill);

        foreach (var item in request.Skills)
        {
            var existingSkill = job.JobSkills.FirstOrDefault(existing => existing.SkillId == item.SkillId);
            if (existingSkill != null)
            {
                existingSkill.IsMandatory = item.IsMandatory;
                existingSkill.Weight = item.Weight;
                continue;
            }

            job.JobSkills.Add(new JobSkill
            {
                JobId = job.JobId,
                SkillId = item.SkillId,
                IsMandatory = item.IsMandatory,
                Weight = item.Weight
            });
        }
        await _uow.SaveChangesAsync(ct);
        return new(true, "Cập nhật công việc thành công.", JobDto.From(job));
    }
    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
