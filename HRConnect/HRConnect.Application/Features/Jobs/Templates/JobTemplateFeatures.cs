using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Jobs.Templates;

// MF-01: shared JD template library. Clients search it by keyword and copy a template into the job
// form; Internal HR and Admin manage it. See HRConnect/docs/main-flows.md (MF-01, thư viện mẫu JD).

public static class JobTemplateConstants
{
    public const string ManagePermission = "job_template.manage";
    public const string SkillCategory = "SKILL";

    public static readonly string[] Levels = ["INTERN", "JUNIOR", "MIDDLE", "SENIOR", "LEAD"];
    public static readonly string[] RequirementCategories = ["EXPERIENCE", "SKILL", "EDUCATION", "OTHER"];

    public const string ErrorCodeDuplicate = "TEMPLATE_CODE_DUPLICATE";
    public const string ErrorNotFound = "TEMPLATE_NOT_FOUND";
    public const string ErrorMustHaveRequired = "TEMPLATE_MUST_HAVE_REQUIRED";
    public const string ErrorConcurrency = "TEMPLATE_CONCURRENCY_CONFLICT";

    public const int MaxKeywordLength = 100;
}

public static class JobTemplateAudit
{
    public const string Created = "JOB_TEMPLATE_CREATED";
    public const string Updated = "JOB_TEMPLATE_UPDATED";
    public const string Deactivated = "JOB_TEMPLATE_DEACTIVATED";
    public const string Activated = "JOB_TEMPLATE_ACTIVATED";
    public const string EntityType = "JOB_TEMPLATE";
}

/// <summary>Accent-free, lower-case text so "ke toan" finds "Kế toán".</summary>
public static class TemplateSearchText
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var decomposed = value.Trim().ToLowerInvariant().Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) builder.Append(c);
        }
        return Regex.Replace(builder.ToString().Normalize(NormalizationForm.FormC), @"\s+", " ");
    }

    /// <summary>Distinct search tokens of a keyword (cut to the maximum keyword length first).</summary>
    public static IReadOnlyList<string> Tokens(string? keyword)
    {
        var text = keyword ?? string.Empty;
        if (text.Length > JobTemplateConstants.MaxKeywordLength) text = text[..JobTemplateConstants.MaxKeywordLength];
        return Normalize(text).Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct().ToList();
    }

    public static string Build(JobTemplate t) =>
        Normalize(string.Join(' ', t.Name, t.Title, t.Keywords, t.Industry, t.Code.Replace('_', ' ')));
}

// ── DTOs ────────────────────────────────────────────────────────────────────

public sealed record JobTemplateRequirementDto(string RequirementType, string? Category, string Content);

public sealed record JobTemplateSummaryDto(
    Guid TemplateId, string Code, string Name, string Industry, string? Level, string? Summary,
    int RequirementCount, int UsageCount, bool IsActive, DateTime UpdatedAt);

public sealed record JobTemplatePageDto(
    IReadOnlyList<JobTemplateSummaryDto> Items, int Page, int PageSize, int TotalCount, int TotalPages);

public sealed record JobTemplateDto(
    Guid TemplateId, string Code, string Name, string Industry, string? Level, string? Keywords, string? Summary,
    string Title, string Description, string? Benefits, string? EmploymentType,
    decimal? MinExperienceYears, decimal? MaxExperienceYears,
    IReadOnlyList<JobTemplateRequirementDto> Requirements,
    bool IsActive, int UsageCount, DateTime UpdatedAt, Guid? ConcurrencyToken);

public sealed record JobTemplateRequirementInput(string RequirementType, string? Category, string Content);

public sealed record JobTemplateInput(
    string Code, string Name, string Industry, string? Level, string? Keywords, string? Summary,
    string Title, string Description, string? Benefits, string? EmploymentType,
    decimal? MinExperienceYears, decimal? MaxExperienceYears,
    IReadOnlyList<JobTemplateRequirementInput> Requirements);

public static class JobTemplateMapping
{
    public static JobTemplateSummaryDto ToSummary(JobTemplate t) => new(
        t.TemplateId, t.Code, t.Name, t.Industry, t.Level, t.Summary,
        t.Requirements.Count, t.UsageCount, t.IsActive, t.UpdatedAt);

    public static JobTemplateDto ToDto(JobTemplate t, bool includeToken) => new(
        t.TemplateId, t.Code, t.Name, t.Industry, t.Level, t.Keywords, t.Summary,
        t.Title, t.Description, t.Benefits, t.EmploymentType, t.MinExperienceYears, t.MaxExperienceYears,
        t.Requirements.OrderBy(r => r.DisplayOrder)
            .Select(r => new JobTemplateRequirementDto(r.RequirementType, r.Category, r.Content)).ToList(),
        t.IsActive, t.UsageCount, t.UpdatedAt, includeToken ? t.ConcurrencyToken : null);

    /// <summary>Copies the input onto the entity (trimmed, upper-cased codes) and rebuilds requirements and search text.</summary>
    public static void Apply(JobTemplate t, JobTemplateInput input)
    {
        t.Code = input.Code.Trim().ToUpperInvariant();
        t.Name = input.Name.Trim();
        t.Industry = input.Industry.Trim().ToUpperInvariant();
        t.Level = string.IsNullOrWhiteSpace(input.Level) ? null : input.Level.Trim().ToUpperInvariant();
        t.Keywords = Trim(input.Keywords);
        t.Summary = Trim(input.Summary);
        t.Title = input.Title.Trim();
        t.Description = input.Description.Trim();
        t.Benefits = Trim(input.Benefits);
        t.EmploymentType = string.IsNullOrWhiteSpace(input.EmploymentType) ? null : input.EmploymentType.Trim().ToUpperInvariant();
        t.MinExperienceYears = input.MinExperienceYears;
        t.MaxExperienceYears = input.MaxExperienceYears;
        t.Requirements = input.Requirements
            .Select((r, index) => new JobTemplateRequirement
            {
                TemplateRequirementId = Guid.NewGuid(),
                TemplateId = t.TemplateId,
                RequirementType = r.RequirementType.Trim().ToUpperInvariant(),
                Category = string.IsNullOrWhiteSpace(r.Category) ? null : r.Category.Trim().ToUpperInvariant(),
                Content = r.Content.Trim(),
                DisplayOrder = index,
            })
            .ToList();
        t.SearchText = TemplateSearchText.Build(t);
    }

    private static string? Trim(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

// ── Search (Client + Internal HR) ───────────────────────────────────────────

/// <summary>
/// Keyword search. Every token must match; matches in the template name rank first, then the most used.
/// <see cref="IncludeInactive"/> is only honoured for template managers.
/// </summary>
public sealed record SearchJobTemplatesQuery(
    string? Keyword, string? Industry, int? Page, int? PageSize, bool IncludeInactive = false, bool? IsActive = null)
    : IRequest<JobTemplatePageDto>;

public sealed class SearchJobTemplatesQueryHandler : IRequestHandler<SearchJobTemplatesQuery, JobTemplatePageDto>
{
    private readonly IJobTemplateRepository _templates;
    private readonly IAdminBusinessSettings _settings;

    public SearchJobTemplatesQueryHandler(IJobTemplateRepository templates, IAdminBusinessSettings settings)
    {
        _templates = templates;
        _settings = settings;
    }

    public async Task<JobTemplatePageDto> Handle(SearchJobTemplatesQuery request, CancellationToken cancellationToken)
    {
        var defaultSize = await _settings.GetIntAsync(BusinessSettingKeys.JobTemplatePageSizeDefault, cancellationToken);
        var maxSize = await _settings.GetIntAsync(BusinessSettingKeys.JobTemplatePageSizeMax, cancellationToken);
        var pageSize = Math.Clamp(request.PageSize ?? defaultSize, 1, Math.Max(1, maxSize));
        var page = Math.Max(1, request.Page ?? 1);

        var tokens = TemplateSearchText.Tokens(request.Keyword);
        var industry = string.IsNullOrWhiteSpace(request.Industry) ? null : request.Industry.Trim().ToUpperInvariant();
        var isActive = request.IncludeInactive ? request.IsActive : true;
        var matches = await _templates.SearchAsync(tokens, industry, isActive, cancellationToken);

        // The library is small (tens of templates), so ranking in memory keeps the SQL simple.
        var ordered = matches
            .OrderByDescending(t => tokens.Count > 0 && tokens.All(token => TemplateSearchText.Normalize(t.Name).Contains(token)))
            .ThenByDescending(t => t.UsageCount)
            .ThenBy(t => t.Name, StringComparer.Create(new CultureInfo("vi-VN"), true))
            .ToList();

        var items = ordered.Skip((page - 1) * pageSize).Take(pageSize).Select(JobTemplateMapping.ToSummary).ToList();
        var totalPages = (int)Math.Ceiling(ordered.Count / (double)pageSize);
        return new JobTemplatePageDto(items, page, pageSize, ordered.Count, totalPages);
    }
}

/// <summary>Full template. Hidden templates are only visible to template managers.</summary>
public sealed record GetJobTemplateQuery(Guid TemplateId, bool CanSeeInactive, bool IncludeConcurrencyToken = false)
    : IRequest<JobTemplateDto>;

public sealed class GetJobTemplateQueryHandler : IRequestHandler<GetJobTemplateQuery, JobTemplateDto>
{
    private readonly IJobTemplateRepository _templates;

    public GetJobTemplateQueryHandler(IJobTemplateRepository templates) => _templates = templates;

    public async Task<JobTemplateDto> Handle(GetJobTemplateQuery request, CancellationToken cancellationToken)
    {
        var template = await _templates.GetByIdAsync(request.TemplateId, cancellationToken);
        if (template == null || (!template.IsActive && !request.CanSeeInactive))
        {
            throw new NotFoundException("Không tìm thấy mẫu JD hoặc mẫu không còn được sử dụng.");
        }
        return JobTemplateMapping.ToDto(template, request.IncludeConcurrencyToken);
    }
}

// ── Manage (Internal HR, Admin) ─────────────────────────────────────────────

public sealed record CreateJobTemplateCommand(JobTemplateInput Input, Guid CurrentUserId) : IRequest<JobTemplateDto>;

public sealed record UpdateJobTemplateCommand(Guid TemplateId, Guid ConcurrencyToken, JobTemplateInput Input, Guid CurrentUserId)
    : IRequest<JobTemplateDto>;

public sealed record SetJobTemplateActiveCommand(Guid TemplateId, bool IsActive, Guid CurrentUserId) : IRequest<JobTemplateDto>;

public sealed class JobTemplateInputValidator : AbstractValidator<JobTemplateInput>
{
    public JobTemplateInputValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Nhập mã mẫu.")
            .MaximumLength(80).WithMessage("Mã mẫu tối đa 80 ký tự.")
            .Matches("^[A-Za-z0-9_]+$").WithMessage("Mã mẫu chỉ gồm chữ không dấu, số và dấu gạch dưới.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Nhập tên mẫu.").MaximumLength(200);
        RuleFor(x => x.Industry).NotEmpty().WithMessage("Chọn ngành.")
            .MaximumLength(80).Matches("^[A-Za-z_]+$").WithMessage("Mã ngành chỉ gồm chữ không dấu và dấu gạch dưới.");
        RuleFor(x => x.Level)
            .Must(level => string.IsNullOrWhiteSpace(level) || JobTemplateConstants.Levels.Contains(level.Trim().ToUpperInvariant()))
            .WithMessage("Cấp bậc phải là INTERN, JUNIOR, MIDDLE, SENIOR hoặc LEAD.");
        RuleFor(x => x.Keywords).MaximumLength(1000);
        RuleFor(x => x.Summary).MaximumLength(500);
        RuleFor(x => x.Title).NotEmpty().WithMessage("Nhập tên vị trí gợi ý.").MaximumLength(255);
        RuleFor(x => x.Description).NotEmpty().WithMessage("Nhập mô tả công việc.").MaximumLength(10000);
        RuleFor(x => x.Benefits).MaximumLength(10000);
        RuleFor(x => x.EmploymentType)
            .Must(value => string.IsNullOrWhiteSpace(value) || EmploymentTypes.All.Contains(value.Trim().ToUpperInvariant()))
            .WithMessage("Hình thức làm việc không hợp lệ.");
        RuleFor(x => x.MinExperienceYears).InclusiveBetween(0, 50).When(x => x.MinExperienceYears.HasValue);
        RuleFor(x => x.MaxExperienceYears).InclusiveBetween(0, 50).When(x => x.MaxExperienceYears.HasValue);
        RuleFor(x => x).Must(x => !x.MinExperienceYears.HasValue || !x.MaxExperienceYears.HasValue || x.MinExperienceYears <= x.MaxExperienceYears)
            .WithName("MaxExperienceYears").WithMessage("Số năm kinh nghiệm tối thiểu không được lớn hơn tối đa.");
        RuleFor(x => x.Requirements).NotNull();
        RuleForEach(x => x.Requirements).ChildRules(r =>
        {
            r.RuleFor(x => x.RequirementType)
                .Must(t => t != null && JobRequirementTypes.All.Contains(t.Trim().ToUpperInvariant()))
                .WithMessage("Loại yêu cầu phải là MUST_HAVE hoặc SHOULD_HAVE.");
            r.RuleFor(x => x.Category).MaximumLength(120);
            r.RuleFor(x => x.Content).NotEmpty().WithMessage("Nội dung yêu cầu không được để trống.").MaximumLength(4000);
        });
    }
}

internal static class JobTemplateRules
{
    public static async Task ValidateAsync(
        JobTemplateInput input, Guid? exceptTemplateId, IJobTemplateRepository templates, CancellationToken ct)
    {
        var result = await new JobTemplateInputValidator().ValidateAsync(input, ct);
        if (!result.IsValid)
        {
            throw new BadRequestException(string.Join(" ", result.Errors.Select(e => e.ErrorMessage).Distinct()));
        }
        if (!input.Requirements.Any(r => string.Equals(r.RequirementType?.Trim(), JobRequirementTypes.MustHave, StringComparison.OrdinalIgnoreCase)))
        {
            throw new BadRequestException("Mẫu cần ít nhất 1 yêu cầu bắt buộc (MUST_HAVE).", JobTemplateConstants.ErrorMustHaveRequired);
        }
        if (await templates.CodeExistsAsync(input.Code.Trim().ToUpperInvariant(), exceptTemplateId, ct))
        {
            throw new BadRequestException("Mã mẫu đã tồn tại.", JobTemplateConstants.ErrorCodeDuplicate);
        }
    }
}

public sealed class CreateJobTemplateCommandHandler : IRequestHandler<CreateJobTemplateCommand, JobTemplateDto>
{
    private readonly IJobTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;

    public CreateJobTemplateCommandHandler(IJobTemplateRepository templates, IUnitOfWork unitOfWork, IAuditLogService audit)
    {
        _templates = templates;
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<JobTemplateDto> Handle(CreateJobTemplateCommand request, CancellationToken cancellationToken)
    {
        await JobTemplateRules.ValidateAsync(request.Input, null, _templates, cancellationToken);
        var now = DateTime.UtcNow;
        var template = new JobTemplate
        {
            TemplateId = Guid.NewGuid(),
            IsActive = true,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = now,
            UpdatedAt = now,
            CreatedBy = request.CurrentUserId,
            UpdatedBy = request.CurrentUserId,
        };
        JobTemplateMapping.Apply(template, request.Input);
        await _templates.AddAsync(template, cancellationToken);
        await _audit.AddAsync(new AuditEntry
        {
            Action = JobTemplateAudit.Created,
            EntityType = JobTemplateAudit.EntityType,
            EntityId = template.TemplateId,
            ActorUserId = request.CurrentUserId,
            NewValues = new { template.Code, template.Name, template.Industry, RequirementCount = template.Requirements.Count }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return JobTemplateMapping.ToDto(template, includeToken: true);
    }
}

public sealed class UpdateJobTemplateCommandHandler : IRequestHandler<UpdateJobTemplateCommand, JobTemplateDto>
{
    private readonly IJobTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;

    public UpdateJobTemplateCommandHandler(IJobTemplateRepository templates, IUnitOfWork unitOfWork, IAuditLogService audit)
    {
        _templates = templates;
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<JobTemplateDto> Handle(UpdateJobTemplateCommand request, CancellationToken cancellationToken)
    {
        var template = await _templates.GetByIdAsync(request.TemplateId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy mẫu JD.");
        if (template.ConcurrencyToken != request.ConcurrencyToken)
        {
            throw new ConflictException("Mẫu vừa được người khác cập nhật. Tải lại để xem bản mới.", JobTemplateConstants.ErrorConcurrency);
        }
        await JobTemplateRules.ValidateAsync(request.Input, template.TemplateId, _templates, cancellationToken);

        var oldValues = new { template.Code, template.Name, template.Industry, RequirementCount = template.Requirements.Count };
        var oldRequirements = template.Requirements.ToList();
        JobTemplateMapping.Apply(template, request.Input);
        _templates.ReplaceRequirements(oldRequirements, template.Requirements);
        template.ConcurrencyToken = Guid.NewGuid();
        template.UpdatedAt = DateTime.UtcNow;
        template.UpdatedBy = request.CurrentUserId;

        await _audit.AddAsync(new AuditEntry
        {
            Action = JobTemplateAudit.Updated,
            EntityType = JobTemplateAudit.EntityType,
            EntityId = template.TemplateId,
            ActorUserId = request.CurrentUserId,
            OldValues = oldValues,
            NewValues = new { template.Code, template.Name, template.Industry, RequirementCount = template.Requirements.Count }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return JobTemplateMapping.ToDto(template, includeToken: true);
    }
}

public sealed class SetJobTemplateActiveCommandHandler : IRequestHandler<SetJobTemplateActiveCommand, JobTemplateDto>
{
    private readonly IJobTemplateRepository _templates;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;

    public SetJobTemplateActiveCommandHandler(IJobTemplateRepository templates, IUnitOfWork unitOfWork, IAuditLogService audit)
    {
        _templates = templates;
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<JobTemplateDto> Handle(SetJobTemplateActiveCommand request, CancellationToken cancellationToken)
    {
        var template = await _templates.GetByIdAsync(request.TemplateId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy mẫu JD.");
        if (template.IsActive != request.IsActive)
        {
            template.IsActive = request.IsActive;
            template.ConcurrencyToken = Guid.NewGuid();
            template.UpdatedAt = DateTime.UtcNow;
            template.UpdatedBy = request.CurrentUserId;
            await _audit.AddAsync(new AuditEntry
            {
                Action = request.IsActive ? JobTemplateAudit.Activated : JobTemplateAudit.Deactivated,
                EntityType = JobTemplateAudit.EntityType,
                EntityId = template.TemplateId,
                ActorUserId = request.CurrentUserId,
                NewValues = new { template.Code, template.IsActive }
            }, cancellationToken);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
        return JobTemplateMapping.ToDto(template, includeToken: true);
    }
}
