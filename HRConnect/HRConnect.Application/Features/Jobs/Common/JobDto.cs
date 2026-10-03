using HRConnect.Application.Common.Exceptions;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.Common;

public sealed record JobRequirementDto(Guid RequirementId, string RequirementType, string? Category, string Content, decimal? Weight);

public sealed record JobSkillDto(Guid SkillId, string? SkillName, bool IsMandatory, decimal? Weight);

public sealed record JobStatusHistoryDto(
    Guid JobStatusHistoryId, string? OldStatus, string NewStatus,
    Guid? ChangedBy, string? Reason, DateTime ChangedAt);

public sealed record JobDto(
    Guid JobId, Guid CompanyId, string? CompanyName, Guid ServiceTypeId, string? ServiceTypeCode,
    string Title, string? Description, string? Benefits, string? Location, string? WorkingTime, string? EmploymentType,
    decimal? SalaryMin, decimal? SalaryMax, bool SalaryNegotiable, string? SalaryNote,
    int? MinExperienceYears, int? MaxExperienceYears,
    string CurrencyCode, int Quantity,
    string Status, string Visibility, string? StatusReason, DateTime? PostedAt,
    DateTime? ClosedAt, DateTime CreatedAt, DateTime UpdatedAt,
    IReadOnlyList<JobRequirementDto> Requirements,
    IReadOnlyList<JobSkillDto> Skills,
    IReadOnlyList<JobStatusHistoryDto> StatusHistories)
{
    public static JobDto From(Job job, bool includeStatusHistories = false) => new(
        job.JobId, job.CompanyId, job.Company?.CompanyName, job.ServiceTypeId, job.ServiceType?.Code,
        job.Title, job.Description, job.Benefits, job.Location, job.WorkingTime, job.EmploymentType,
        job.SalaryMin, job.SalaryMax, job.SalaryNegotiable, job.SalaryNote,
        job.MinExperienceYears, job.MaxExperienceYears,
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
    private static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> AllowedTransitions =
        new Dictionary<string, IReadOnlySet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [JobStatuses.Draft] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                JobStatuses.PendingReview
            },
            [JobStatuses.PendingReview] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                JobStatuses.Active,
                JobStatuses.Rejected
            },
            [JobStatuses.Rejected] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                JobStatuses.PendingReview
            },
            [JobStatuses.Active] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                JobStatuses.Paused,
                JobStatuses.Closed
            },
            [JobStatuses.Paused] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                JobStatuses.Active,
                JobStatuses.Closed
            }
        };

    public static bool IsAllowed(string currentStatus, string newStatus) =>
        AllowedTransitions.TryGetValue(currentStatus, out var allowed) && allowed.Contains(newStatus);

    public static void ChangeStatus(Job job, string newStatus, Guid userId, string? reason = null)
    {
        var oldStatus = job.Status;
        if (!IsAllowed(oldStatus, newStatus))
            throw new ConflictException($"Không thể chuyển Job từ trạng thái {oldStatus} sang {newStatus}.");

        var now = DateTime.UtcNow;
        job.Status = newStatus;
        job.StatusReason = reason;
        job.UpdatedAt = now;
        job.JobStatusHistories.Add(new JobStatusHistory
        {
            JobStatusHistoryId = Guid.NewGuid(),
            JobId = job.JobId,
            OldStatus = oldStatus,
            NewStatus = newStatus,
            ChangedBy = userId,
            Reason = reason,
            ChangedAt = now
        });
    }
}
