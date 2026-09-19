using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.Common;

public sealed record JobRequirementDto(Guid RequirementId, string RequirementType, string? Category, string Content, decimal? Weight);

public sealed record JobDto(
    Guid JobId, Guid CompanyId, string? CompanyName, Guid ServiceTypeId, string? ServiceTypeCode,
    string Title, string? Description, string? Location, string? EmploymentType,
    decimal? SalaryMin, decimal? SalaryMax, string CurrencyCode, int Quantity,
    string Status, string Visibility, string? StatusReason, DateTime? PostedAt,
    DateTime? ClosedAt, DateTime CreatedAt, DateTime UpdatedAt,
    IReadOnlyList<JobRequirementDto> Requirements)
{
    public static JobDto From(Job job) => new(
        job.JobId, job.CompanyId, job.Company?.CompanyName, job.ServiceTypeId, job.ServiceType?.Code,
        job.Title, job.Description, job.Location, job.EmploymentType, job.SalaryMin, job.SalaryMax,
        job.CurrencyCode.Trim(), job.Quantity, job.Status, job.Visibility, job.StatusReason,
        job.PostedAt, job.ClosedAt, job.CreatedAt, job.UpdatedAt,
        job.JobRequirements.Select(x => new JobRequirementDto(
            x.RequirementId, x.RequirementType, x.Category, x.Content, x.Weight)).ToList());
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
