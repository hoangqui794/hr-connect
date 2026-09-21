using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.Common;

public sealed record JobRequirementDto(Guid RequirementId, string RequirementType, string? Category, string Content, decimal? Weight);

public sealed record JobSkillDto(Guid SkillId, string? SkillName, bool IsMandatory, decimal? Weight);

public sealed record JobStatusHistoryDto(
    Guid JobStatusHistoryId, string? OldStatus, string NewStatus,
    Guid? ChangedBy, string? Reason, DateTime ChangedAt);

public sealed record JobDto(
    Guid JobId, Guid CompanyId, string? CompanyName, Guid ServiceTypeId, string? ServiceTypeCode,
    string Title, string? Description, string? Location, string? EmploymentType,
    decimal? SalaryMin, decimal? SalaryMax, string CurrencyCode, int Quantity,
    string Status, string Visibility, string? StatusReason, DateTime? PostedAt,
    DateTime? ClosedAt, DateTime CreatedAt, DateTime UpdatedAt,
    IReadOnlyList<JobRequirementDto> Requirements,
    IReadOnlyList<JobSkillDto> Skills,
    IReadOnlyList<JobStatusHistoryDto> StatusHistories)
{
    public static JobDto From(Job job, bool includeStatusHistories = false) => new(
        job.JobId, job.CompanyId, job.Company?.CompanyName, job.ServiceTypeId, job.ServiceType?.Code,
        job.Title, job.Description, job.Location, job.EmploymentType, job.SalaryMin, job.SalaryMax,
        job.CurrencyCode.Trim(), job.Quantity, job.Status, job.Visibility, job.StatusReason,
        job.PostedAt, job.ClosedAt, job.CreatedAt, job.UpdatedAt,
        job.JobRequirements.OrderBy(x => x.CreatedAt).Select(x => new JobRequirementDto(
            x.RequirementId, x.RequirementType, x.Category, x.Content, x.Weight)).ToList(),
        job.JobSkills.OrderBy(x => x.SkillId).Select(x => new JobSkillDto(
            x.SkillId, x.Skill?.SkillName, x.IsMandatory, x.Weight)).ToList(),
        includeStatusHistories
            ? job.JobStatusHistories.OrderBy(x => x.ChangedAt).Select(x => new JobStatusHistoryDto(
                x.JobStatusHistoryId, x.OldStatus, x.NewStatus, x.ChangedBy, x.Reason, x.ChangedAt)).ToList()
            : []);
}

public sealed record JobActionResponse(bool Success, string Message, JobDto Data);

public static class JobTransitions
{
    public static void ChangeStatus(Job job, string newStatus, Guid userId, string? reason = null)
    {
        var oldStatus = job.Status;
        var now = DateTime.UtcNow;
        job.Status = newStatus;
        job.StatusReason = reason;
        job.UpdatedAt = now;
        job.JobStatusHistories.Add(new JobStatusHistory
        {
            JobStatusHistoryId = Guid.NewGuid(), JobId = job.JobId, OldStatus = oldStatus,
            NewStatus = newStatus, ChangedBy = userId, Reason = reason, ChangedAt = now
        });
    }
}
