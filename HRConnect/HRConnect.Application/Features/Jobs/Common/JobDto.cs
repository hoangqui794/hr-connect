using HRConnect.Application.Common.Exceptions;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Features.Jobs.Common;

public sealed record JobRequirementDto(Guid RequirementId, string RequirementType, string? Category, string Content, decimal? Weight);

public sealed record JobSkillDto(Guid SkillId, string? SkillName, bool IsMandatory, decimal? Weight);

public sealed record JobStatusHistoryDto(
    Guid JobStatusHistoryId, string? OldStatus, string NewStatus,
    Guid? ChangedBy, string? ReasonCode, string? ReasonText, DateTime ChangedAt);

public sealed record PublicCompanyDto(
    Guid CompanyId,
    string CompanyName,
    string? LogoUrl,
    string? Industry,
    string? CompanySize,
    string? Website,
    string? Address,
    string? Description,
    bool IsVerified)
{
    public static PublicCompanyDto? From(Company? company)
    {
        if (company == null) return null;

        var normalizedWebsite = NormalizeWebsite(company.Website);
        var isVerified = string.Equals(company.VerificationStatus, "VERIFIED", StringComparison.OrdinalIgnoreCase);

        return new PublicCompanyDto(
            company.CompanyId,
            company.CompanyName,
            null, // Logo URL will be added when object storage is introduced (returns null for initials)
            company.Industry,
            company.CompanySize,
            normalizedWebsite,
            company.Address,
            company.Description,
            isVerified);
    }

    private static string? NormalizeWebsite(string? website)
    {
        if (string.IsNullOrWhiteSpace(website)) return null;
        var trimmed = website.Trim();
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            return trimmed;
        }

        return Uri.TryCreate("https://" + trimmed, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? uri.ToString()
            : null;
    }
}

public sealed record JobListItemDto(
    Guid JobId,
    string Title,
    Guid CompanyId,
    string? CompanyName,
    Guid ServiceTypeId,
    string? ServiceTypeCode,
    string? Location,
    string? EmploymentType,
    decimal? SalaryMin,
    decimal? SalaryMax,
    bool SalaryNegotiable,
    string CurrencyCode,
    string Status,
    int? MinExperienceYears,
    int? MaxExperienceYears,
    DateTime? PostedAt,
    DateTime? ApplicationDeadline,
    bool IsAcceptingApplications)
{
    public static JobListItemDto From(Job job) => new(
        job.JobId,
        job.Title,
        job.CompanyId,
        job.Company?.CompanyName,
        job.ServiceTypeId,
        job.ServiceType?.Code,
        job.Location,
        job.EmploymentType,
        job.SalaryMin,
        job.SalaryMax,
        job.SalaryNegotiable,
        job.CurrencyCode.Trim(),
        job.Status,
        job.MinExperienceYears,
        job.MaxExperienceYears,
        job.PostedAt,
        job.ApplicationDeadline,
        JobAccessPolicy.IsAcceptingApplications(job));
}

public sealed record JobDto(
    Guid JobId, Guid CompanyId, string? CompanyName, Guid ServiceTypeId, string? ServiceTypeCode,
    string Title, string? Description, string? Benefits, string? Location, string? WorkingTime, string? EmploymentType,
    decimal? SalaryMin, decimal? SalaryMax, bool SalaryNegotiable, string? SalaryNote,
    int? MinExperienceYears, int? MaxExperienceYears,
    string CurrencyCode, int Quantity,
    string Status, string Visibility, string? StatusReason, DateTime? PostedAt,
    DateTime? ClosedAt, DateTime CreatedAt, DateTime UpdatedAt, Guid ConcurrencyToken,
    int? SourcingTarget, decimal? SourcingPricePerCv, decimal? FeeMultiplier, int? WarrantyDays, int? PaymentDueDays,
    Guid? PostingPackageId, string? PostingPackageCode, string? PostingPackageName, DateTime? ExpiresAt,
    string? PostingFeeStatus,
    DateTime? ApplicationDeadline, bool IsAcceptingApplications,
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
        job.PostedAt, job.ClosedAt, job.CreatedAt, job.UpdatedAt, job.ConcurrencyToken,
        job.SourcingTarget, job.SourcingPricePerCv, job.FeeMultiplier, job.WarrantyDays, job.PaymentDueDays,
        job.PostingPackageId, job.PostingPackage?.Code, job.PostingPackage?.Name, job.ExpiresAt,
        job.JobPostingFees.OrderByDescending(x => x.CreatedAt).FirstOrDefault()?.Status,
        job.ApplicationDeadline,
        JobAccessPolicy.IsAcceptingApplications(job),
        job.JobRequirements.OrderBy(x => x.CreatedAt).Select(x => new JobRequirementDto(
            x.RequirementId, x.RequirementType, x.Category, x.Content, x.Weight)).ToList(),
        job.JobSkills.OrderBy(x => x.SkillId).Select(x => new JobSkillDto(
            x.SkillId, x.Skill?.SkillName, x.IsMandatory, x.Weight)).ToList(),
        includeStatusHistories
            ? job.JobStatusHistories.OrderBy(x => x.ChangedAt).Select(x => new JobStatusHistoryDto(
                x.JobStatusHistoryId, x.OldStatus, x.NewStatus, x.ChangedBy, x.ReasonCode, x.ReasonText, x.ChangedAt)).ToList()
            : []);
}

public sealed record JobDetailDto(
    Guid JobId, Guid CompanyId, string? CompanyName, Guid ServiceTypeId, string? ServiceTypeCode,
    string Title, string? Description, string? Benefits, string? Location, string? WorkingTime, string? EmploymentType,
    decimal? SalaryMin, decimal? SalaryMax, bool SalaryNegotiable, string? SalaryNote,
    int? MinExperienceYears, int? MaxExperienceYears,
    string CurrencyCode, int Quantity,
    string Status, string Visibility, string? StatusReason, DateTime? PostedAt,
    DateTime? ClosedAt, DateTime CreatedAt, DateTime UpdatedAt, Guid ConcurrencyToken,
    int? SourcingTarget, decimal? SourcingPricePerCv, decimal? FeeMultiplier, int? WarrantyDays, int? PaymentDueDays,
    Guid? PostingPackageId, string? PostingPackageCode, string? PostingPackageName, DateTime? ExpiresAt,
    string? PostingFeeStatus,
    DateTime? ApplicationDeadline, bool IsAcceptingApplications,
    IReadOnlyList<JobRequirementDto> Requirements,
    IReadOnlyList<JobSkillDto> Skills,
    IReadOnlyList<JobStatusHistoryDto> StatusHistories,
    PublicCompanyDto? Company)
{
    public static JobDetailDto From(Job job, bool includeStatusHistories = false) => new(
        job.JobId, job.CompanyId, job.Company?.CompanyName, job.ServiceTypeId, job.ServiceType?.Code,
        job.Title, job.Description, job.Benefits, job.Location, job.WorkingTime, job.EmploymentType,
        job.SalaryMin, job.SalaryMax, job.SalaryNegotiable, job.SalaryNote,
        job.MinExperienceYears, job.MaxExperienceYears,
        job.CurrencyCode.Trim(), job.Quantity, job.Status, job.Visibility, job.StatusReason,
        job.PostedAt, job.ClosedAt, job.CreatedAt, job.UpdatedAt, job.ConcurrencyToken,
        job.SourcingTarget, job.SourcingPricePerCv, job.FeeMultiplier, job.WarrantyDays, job.PaymentDueDays,
        job.PostingPackageId, job.PostingPackage?.Code, job.PostingPackage?.Name, job.ExpiresAt,
        job.JobPostingFees.OrderByDescending(x => x.CreatedAt).FirstOrDefault()?.Status,
        job.ApplicationDeadline,
        JobAccessPolicy.IsAcceptingApplications(job),
        job.JobRequirements.OrderBy(x => x.CreatedAt).Select(x => new JobRequirementDto(
            x.RequirementId, x.RequirementType, x.Category, x.Content, x.Weight)).ToList(),
        job.JobSkills.OrderBy(x => x.SkillId).Select(x => new JobSkillDto(
            x.SkillId, x.Skill?.SkillName, x.IsMandatory, x.Weight)).ToList(),
        includeStatusHistories
            ? job.JobStatusHistories.OrderBy(x => x.ChangedAt).Select(x => new JobStatusHistoryDto(
                x.JobStatusHistoryId, x.OldStatus, x.NewStatus, x.ChangedBy, x.ReasonCode, x.ReasonText, x.ChangedAt)).ToList()
            : [],
        PublicCompanyDto.From(job.Company));
}

public sealed record JobPostingPackageDto(
    Guid PackageId,
    string Code,
    string Name,
    string? Description,
    decimal Price,
    int DurationDays,
    bool IsActive);

public sealed record JobPostingFeeDto(
    Guid PostingFeeId,
    Guid JobId,
    Guid PackageId,
    string? PackageCode,
    string? PackageName,
    decimal Amount,
    string CurrencyCode,
    string Status,
    DateTime? PaidAt,
    string? PaymentReference,
    DateTime? ActivatedAt,
    DateTime? ExpiresAt,
    DateTime CreatedAt);


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

    public static void ChangeStatus(Job job, string newStatus, Guid userId, string reasonCode, string? reasonText = null)
    {
        var oldStatus = job.Status;
        if (!IsAllowed(oldStatus, newStatus))
            throw new ConflictException($"Không thể chuyển Job từ trạng thái {oldStatus} sang {newStatus}.");

        var now = DateTime.UtcNow;
        job.Status = newStatus;
        job.StatusReason = reasonText;
        job.UpdatedAt = now;
        job.ConcurrencyToken = Guid.NewGuid();
        job.JobStatusHistories.Add(new JobStatusHistory
        {
            JobStatusHistoryId = Guid.NewGuid(),
            JobId = job.JobId,
            OldStatus = oldStatus,
            NewStatus = newStatus,
            ChangedBy = userId,
            ReasonCode = reasonCode,
            ReasonText = reasonText,
            ChangedAt = now
        });
    }

    public static void RequireCurrentToken(Job job, Guid token)
    {
        if (token != job.ConcurrencyToken)
            throw new ConflictException("Job đã được thay đổi bởi người dùng khác. Hãy tải lại dữ liệu và thử lại.");
    }
}
