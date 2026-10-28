using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
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
    public static PublicCompanyDto? From(Company? company, ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        if (company == null) return null;

        var normalizedWebsite = NormalizeWebsite(company.Website);
        var isVerified = string.Equals(company.VerificationStatus, "VERIFIED", StringComparison.OrdinalIgnoreCase);

        return new PublicCompanyDto(
            company.CompanyId,
            company.CompanyName,
            logoUrlResolver?.Resolve(company) ?? company.LogoUrl,
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
    decimal? MinExperienceYears,
    decimal? MaxExperienceYears,
    DateTime? PostedAt,
    DateTime? ApplicationDeadline,
    bool IsAcceptingApplications,
    bool HasSignedAgreement = false)
{
    public PublicCompanyDto? Company { get; init; }

    public static JobListItemDto From(Job job, ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        var agreement = job.CurrentServiceAgreement ?? job.ServiceAgreements?.FirstOrDefault(x => x.IsCurrent);
        var hasSignedAgreement = agreement != null &&
            (!string.IsNullOrWhiteSpace(agreement.SignedDocumentStorageKey) ||
             agreement.SignedAt != null ||
             agreement.Status == "SIGNED");

        return new(
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
            JobAccessPolicy.IsAcceptingApplications(job),
            hasSignedAgreement)
        {
            Company = PublicCompanyDto.From(job.Company, logoUrlResolver)
        };
    }
}

public sealed record JobDto(
    Guid JobId, Guid CompanyId, string? CompanyName, Guid ServiceTypeId, string? ServiceTypeCode,
    string Title, string? Description, string? Benefits, string? Location, string? WorkingTime, string? EmploymentType,
    decimal? SalaryMin, decimal? SalaryMax, bool SalaryNegotiable, string? SalaryNote,
    decimal? MinExperienceYears, decimal? MaxExperienceYears,
    string CurrencyCode, int Quantity,
    string Status, string? StatusReason, DateTime? PostedAt,
    DateTime? ClosedAt, DateTime CreatedAt, DateTime UpdatedAt, Guid ConcurrencyToken,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] int? SourcingTarget,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] decimal? SourcingPricePerCv,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] decimal? FeeMultiplier,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] int? WarrantyDays,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] int? PaymentDueDays,
    JobProposedTermsDto? ProposedTerms,
    JobCommercialTermsDto? CommercialTerms,
    Guid? PostingPackageId, string? PostingPackageCode, string? PostingPackageName, DateTime? ExpiresAt,
    int? MaxApplications,
    string? PostingFeeStatus,
    DateTime? ApplicationDeadline, bool IsAcceptingApplications,
    IReadOnlyList<JobRequirementDto> Requirements,
    IReadOnlyList<JobSkillDto> Skills,
    IReadOnlyList<JobStatusHistoryDto> StatusHistories,
    Guid? TemplateId = null,
    bool HasSignedAgreement = false)
{
    public string? CompanyLogoUrl { get; init; }

    public static JobDto From(Job job, bool includeStatusHistories = false, bool isReviewer = false,
        ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        var hasProposed = job.ProposedFeeMultiplier != null ||
                          job.ProposedWarrantyDays != null ||
                          job.ProposedPaymentDueDays != null ||
                          job.ProposedPricePerCv != null ||
                          !string.IsNullOrWhiteSpace(job.ProposedFeeNote);

        var proposedTerms = hasProposed
            ? new JobProposedTermsDto(
                job.ProposedFeeMultiplier,
                job.ProposedWarrantyDays,
                job.ProposedPaymentDueDays,
                job.ProposedPricePerCv,
                job.ProposedFeeNote)
            : null;

        var hasCommercial = job.AgreedAt != null ||
                            job.FeeMultiplier != null ||
                            job.WarrantyDays != null ||
                            job.PaymentDueDays != null ||
                            job.SourcingPricePerCv != null ||
                            job.DepositPercent != null ||
                            job.ReviewDays != null;

        var commercialTerms = hasCommercial
            ? new JobCommercialTermsDto(
                job.ServiceType?.Code,
                job.FeeMultiplier,
                job.WarrantyDays,
                job.PaymentDueDays,
                job.SourcingTarget,
                job.SourcingPricePerCv,
                job.DepositPercent,
                job.ReviewDays,
                job.AgreedAt,
                job.AgreedByNavigation?.DisplayName ?? (job.AgreedBy.HasValue ? job.AgreedBy.Value.ToString() : null),
                isReviewer ? job.AgreementReference : null,
                isReviewer ? job.AgreementNote : null)
            : null;

        return new(
            job.JobId, job.CompanyId, job.Company?.CompanyName, job.ServiceTypeId, job.ServiceType?.Code,
            job.Title, job.Description, job.Benefits, job.Location, job.WorkingTime, job.EmploymentType,
            job.SalaryMin, job.SalaryMax, job.SalaryNegotiable, job.SalaryNote,
            job.MinExperienceYears, job.MaxExperienceYears,
            job.CurrencyCode?.Trim() ?? string.Empty, job.Quantity, job.Status, job.StatusReason,
            job.PostedAt, job.ClosedAt, job.CreatedAt, job.UpdatedAt, job.ConcurrencyToken,
            job.SourcingTarget, job.SourcingPricePerCv, job.FeeMultiplier, job.WarrantyDays, job.PaymentDueDays,
            proposedTerms, commercialTerms,
            job.PostingPackageId, job.PostingPackage?.Code, job.PostingPackage?.Name, job.ExpiresAt,
            job.MaxApplications ?? job.PostingPackage?.MaxApplications,
            job.JobPostingFees?.OrderByDescending(x => x.CreatedAt).FirstOrDefault()?.Status,
            job.ApplicationDeadline,
            JobAccessPolicy.IsAcceptingApplications(job),
            job.JobRequirements != null ? job.JobRequirements.OrderBy(x => x.CreatedAt).Select(x => new JobRequirementDto(
                x.RequirementId, x.RequirementType, x.Category, x.Content, x.Weight)).ToList() : [],
            job.JobSkills != null ? job.JobSkills.OrderBy(x => x.SkillId).Select(x => new JobSkillDto(
                x.SkillId, x.Skill?.SkillName, x.IsMandatory, x.Weight)).ToList() : [],
            includeStatusHistories && job.JobStatusHistories != null
                ? job.JobStatusHistories.OrderBy(x => x.ChangedAt).Select(x => new JobStatusHistoryDto(
                    x.JobStatusHistoryId, x.OldStatus, x.NewStatus, x.ChangedBy, x.ReasonCode, x.ReasonText, x.ChangedAt)).ToList()
                : [],
            job.TemplateId,
            (job.CurrentServiceAgreement ?? job.ServiceAgreements?.FirstOrDefault(x => x.IsCurrent)) is { } a &&
                (!string.IsNullOrWhiteSpace(a.SignedDocumentStorageKey) || a.SignedAt != null || a.Status == "SIGNED"))
        {
            CompanyLogoUrl = job.Company is null ? null : logoUrlResolver?.Resolve(job.Company) ?? job.Company.LogoUrl
        };
    }
}

public sealed record JobDetailDto(
    Guid JobId, Guid CompanyId, string? CompanyName, Guid ServiceTypeId, string? ServiceTypeCode,
    string Title, string? Description, string? Benefits, string? Location, string? WorkingTime, string? EmploymentType,
    decimal? SalaryMin, decimal? SalaryMax, bool SalaryNegotiable, string? SalaryNote,
    decimal? MinExperienceYears, decimal? MaxExperienceYears,
    string CurrencyCode, int Quantity,
    string Status, string? StatusReason, DateTime? PostedAt,
    DateTime? ClosedAt, DateTime CreatedAt, DateTime UpdatedAt, Guid ConcurrencyToken,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] int? SourcingTarget,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] decimal? SourcingPricePerCv,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] decimal? FeeMultiplier,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] int? WarrantyDays,
    [property: Obsolete("Sử dụng CommercialTerms. Sẽ bị xóa trong bản phát hành sau.")] int? PaymentDueDays,
    JobProposedTermsDto? ProposedTerms,
    JobCommercialTermsDto? CommercialTerms,
    Guid? PostingPackageId, string? PostingPackageCode, string? PostingPackageName, DateTime? ExpiresAt,
    int? MaxApplications,
    string? PostingFeeStatus,
    DateTime? ApplicationDeadline, bool IsAcceptingApplications,
    IReadOnlyList<JobRequirementDto> Requirements,
    IReadOnlyList<JobSkillDto> Skills,
    IReadOnlyList<JobStatusHistoryDto> StatusHistories,
    PublicCompanyDto? Company,
    Guid? TemplateId = null,
    bool HasSignedAgreement = false)
{
    public static JobDetailDto From(Job job, bool includeStatusHistories = false, bool isReviewer = false,
        ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        var hasProposed = job.ProposedFeeMultiplier != null ||
                          job.ProposedWarrantyDays != null ||
                          job.ProposedPaymentDueDays != null ||
                          job.ProposedPricePerCv != null ||
                          !string.IsNullOrWhiteSpace(job.ProposedFeeNote);

        var proposedTerms = hasProposed
            ? new JobProposedTermsDto(
                job.ProposedFeeMultiplier,
                job.ProposedWarrantyDays,
                job.ProposedPaymentDueDays,
                job.ProposedPricePerCv,
                job.ProposedFeeNote)
            : null;

        var hasCommercial = job.AgreedAt != null ||
                            job.FeeMultiplier != null ||
                            job.WarrantyDays != null ||
                            job.PaymentDueDays != null ||
                            job.SourcingPricePerCv != null ||
                            job.DepositPercent != null ||
                            job.ReviewDays != null;

        var commercialTerms = hasCommercial
            ? new JobCommercialTermsDto(
                job.ServiceType?.Code,
                job.FeeMultiplier,
                job.WarrantyDays,
                job.PaymentDueDays,
                job.SourcingTarget,
                job.SourcingPricePerCv,
                job.DepositPercent,
                job.ReviewDays,
                job.AgreedAt,
                job.AgreedByNavigation?.DisplayName ?? (job.AgreedBy.HasValue ? job.AgreedBy.Value.ToString() : null),
                isReviewer ? job.AgreementReference : null,
                isReviewer ? job.AgreementNote : null)
            : null;

        return new(
            job.JobId, job.CompanyId, job.Company?.CompanyName, job.ServiceTypeId, job.ServiceType?.Code,
            job.Title, job.Description, job.Benefits, job.Location, job.WorkingTime, job.EmploymentType,
            job.SalaryMin, job.SalaryMax, job.SalaryNegotiable, job.SalaryNote,
            job.MinExperienceYears, job.MaxExperienceYears,
            job.CurrencyCode?.Trim() ?? string.Empty, job.Quantity, job.Status, job.StatusReason,
            job.PostedAt, job.ClosedAt, job.CreatedAt, job.UpdatedAt, job.ConcurrencyToken,
            job.SourcingTarget, job.SourcingPricePerCv, job.FeeMultiplier, job.WarrantyDays, job.PaymentDueDays,
            proposedTerms, commercialTerms,
            job.PostingPackageId, job.PostingPackage?.Code, job.PostingPackage?.Name, job.ExpiresAt,
            job.MaxApplications ?? job.PostingPackage?.MaxApplications,
            job.JobPostingFees?.OrderByDescending(x => x.CreatedAt).FirstOrDefault()?.Status,
            job.ApplicationDeadline,
            JobAccessPolicy.IsAcceptingApplications(job),
            job.JobRequirements != null ? job.JobRequirements.OrderBy(x => x.CreatedAt).Select(x => new JobRequirementDto(
                x.RequirementId, x.RequirementType, x.Category, x.Content, x.Weight)).ToList() : [],
            job.JobSkills != null ? job.JobSkills.OrderBy(x => x.SkillId).Select(x => new JobSkillDto(
                x.SkillId, x.Skill?.SkillName, x.IsMandatory, x.Weight)).ToList() : [],
            includeStatusHistories && job.JobStatusHistories != null
                ? job.JobStatusHistories.OrderBy(x => x.ChangedAt).Select(x => new JobStatusHistoryDto(
                    x.JobStatusHistoryId, x.OldStatus, x.NewStatus, x.ChangedBy, x.ReasonCode, x.ReasonText, x.ChangedAt)).ToList()
                : [],
            PublicCompanyDto.From(job.Company, logoUrlResolver),
            job.TemplateId,
            (job.CurrentServiceAgreement ?? job.ServiceAgreements?.FirstOrDefault(x => x.IsCurrent)) is { } ag &&
                (!string.IsNullOrWhiteSpace(ag.SignedDocumentStorageKey) || ag.SignedAt != null || ag.Status == "SIGNED"));
    }
}

public sealed record JobPostingPackageDto(
    Guid PackageId,
    string Code,
    string Name,
    string? Description,
    decimal Price,
    int DurationDays,
    int? MaxApplications,
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
                JobStatuses.PendingPayment,
                JobStatuses.PendingAgreement,
                JobStatuses.Rejected
            },
            [JobStatuses.PendingAgreement] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                JobStatuses.PendingAgreement,
                JobStatuses.Active,
                JobStatuses.PendingPayment,
                JobStatuses.Rejected
            },
            [JobStatuses.PendingPayment] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                JobStatuses.Active,
                JobStatuses.Closed
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
