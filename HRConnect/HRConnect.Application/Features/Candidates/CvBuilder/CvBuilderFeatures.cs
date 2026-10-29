using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Candidates.CvBuilder;

// BE-04 B: the two CV creation modes besides upload. TEMPLATE_FORM fills a chosen template;
// PLATFORM_BUILDER uses the default layout. The server renders a PDF and stores it like an uploaded
// CV, so applying (MF-02) and AI scoring (MF-03) use it unchanged.

public sealed record CvExperience(string? Title, string? Company, string? StartDate, string? EndDate, string? Description);

public sealed record CvEducation(string? School, string? Degree, string? StartDate, string? EndDate, string? Description);

public sealed record CvProject(
    string? Name, string? Role, string? StartDate, string? EndDate, string? Description,
    string? Technologies, string? Url);

public sealed record CvActivity(string? Name, string? Role, string? StartDate, string? EndDate, string? Description);

/// <summary>Visual choices saved with the CV so reopening and PDF export keep the same design.</summary>
public sealed record CvPresentation(
    string? AccentColor,
    string? Density,
    string? FontFamily,
    string? Layout,
    IReadOnlyList<string>? VisibleSections = null,
    bool ShowAvatar = false);

/// <summary>Content the candidate fills in; the FE sends and receives it as structuredContent.</summary>
public sealed record StructuredCvContent(
    string FullName,
    string? Headline,
    string? Email,
    string? Phone,
    string? Address,
    string? Summary,
    IReadOnlyList<CvExperience>? Experiences,
    IReadOnlyList<CvEducation>? Educations,
    IReadOnlyList<string>? Skills,
    IReadOnlyList<string>? Languages,
    IReadOnlyList<string>? Certificates,
    CvPresentation? Presentation = null,
    IReadOnlyList<CvProject>? Projects = null,
    IReadOnlyList<CvActivity>? Activities = null);

public sealed record CvTemplateDto(Guid CvTemplateId, string Code, string Name, string? Description, string? PreviewUrl, string TemplateConfig);

public sealed record StructuredCvDto(
    Guid CvId, string Title, string CreationMethod, Guid? CvTemplateId, StructuredCvContent Content,
    bool IsPrimary, string Status, DateTime UpdatedAt);

public static class CvCreationMethods
{
    public const string PlatformBuilder = "PLATFORM_BUILDER";
    public const string TemplateForm = "TEMPLATE_FORM";
}

public interface ICvTemplateRepository
{
    Task<IReadOnlyList<CvTemplate>> GetActiveAsync(CancellationToken cancellationToken = default);

    Task<CvTemplate?> GetActiveByIdAsync(Guid id, CancellationToken cancellationToken = default);
}

/// <summary>Renders the PDF, checks it with the CV PDF rules, stores it and saves the CV (Infrastructure).</summary>
public interface IStructuredCvService
{
    Task<CandidateCv> CreateAsync(
        Guid candidateId, Guid actorUserId, string title, CvTemplate? template, StructuredCvContent content, bool isPrimary,
        CancellationToken cancellationToken = default);

    Task<CandidateCv> UpdateAsync(
        CandidateCv cv, Guid actorUserId, string title, CvTemplate? template, StructuredCvContent content,
        CancellationToken cancellationToken = default);
}

public sealed record GetCvTemplatesQuery : IRequest<IReadOnlyList<CvTemplateDto>>;

public sealed record CreateStructuredCvCommand(
    Guid UserId, string Title, Guid? CvTemplateId, StructuredCvContent? Content, bool IsPrimary) : IRequest<StructuredCvDto>;

public sealed record UpdateStructuredCvCommand(
    Guid UserId, Guid CvId, string Title, Guid? CvTemplateId, StructuredCvContent? Content) : IRequest<StructuredCvDto>;

public sealed record GetStructuredCvQuery(Guid UserId, Guid CvId) : IRequest<StructuredCvDto>;

public sealed class CvBuilderHandlers :
    IRequestHandler<GetCvTemplatesQuery, IReadOnlyList<CvTemplateDto>>,
    IRequestHandler<CreateStructuredCvCommand, StructuredCvDto>,
    IRequestHandler<UpdateStructuredCvCommand, StructuredCvDto>,
    IRequestHandler<GetStructuredCvQuery, StructuredCvDto>
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private const int MaxShort = 200;
    private const int MaxLong = 3000;
    private const int MaxItems = 30;

    private readonly ICvTemplateRepository _templates;
    private readonly ICandidateRepository _candidates;
    private readonly ICandidateCvRepository _cvs;
    private readonly IStructuredCvService _service;

    public CvBuilderHandlers(
        ICvTemplateRepository templates, ICandidateRepository candidates, ICandidateCvRepository cvs, IStructuredCvService service)
    {
        _templates = templates;
        _candidates = candidates;
        _cvs = cvs;
        _service = service;
    }

    public async Task<IReadOnlyList<CvTemplateDto>> Handle(GetCvTemplatesQuery request, CancellationToken cancellationToken) =>
        (await _templates.GetActiveAsync(cancellationToken))
        .Select(t => new CvTemplateDto(t.CvTemplateId, t.Code, t.Name, t.Description, t.PreviewUrl, t.TemplateConfig))
        .ToList();

    public async Task<StructuredCvDto> Handle(CreateStructuredCvCommand request, CancellationToken cancellationToken)
    {
        var candidateId = await CandidateIdAsync(request.UserId, cancellationToken);
        var content = Validate(request.Content);
        var template = await TemplateAsync(request.CvTemplateId, cancellationToken);
        var cv = await _service.CreateAsync(candidateId, request.UserId, Title(request.Title), template, content, request.IsPrimary, cancellationToken);
        return ToDto(cv, content);
    }

    public async Task<StructuredCvDto> Handle(UpdateStructuredCvCommand request, CancellationToken cancellationToken)
    {
        var cv = await OwnStructuredCvAsync(request.UserId, request.CvId, cancellationToken);
        var content = Validate(request.Content);
        var template = await TemplateAsync(request.CvTemplateId, cancellationToken);
        cv = await _service.UpdateAsync(cv, request.UserId, Title(request.Title), template, content, cancellationToken);
        return ToDto(cv, content);
    }

    public async Task<StructuredCvDto> Handle(GetStructuredCvQuery request, CancellationToken cancellationToken)
    {
        var cv = await OwnStructuredCvAsync(request.UserId, request.CvId, cancellationToken);
        var content = JsonSerializer.Deserialize<StructuredCvContent>(cv.StructuredContent!, Json)
            ?? throw new NotFoundException("CV không có nội dung để sửa.");
        return ToDto(cv, content);
    }

    private async Task<Guid> CandidateIdAsync(Guid userId, CancellationToken cancellationToken) =>
        (await _candidates.GetByUserIdAsync(userId, cancellationToken))?.CandidateId
        ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên của tài khoản này.");

    private async Task<CandidateCv> OwnStructuredCvAsync(Guid userId, Guid cvId, CancellationToken cancellationToken)
    {
        var candidateId = await CandidateIdAsync(userId, cancellationToken);
        var cv = await _cvs.GetByCandidateIdAndCvIdAsync(candidateId, cvId, cancellationToken);
        if (cv == null || cv.Status == "DELETED")
        {
            throw new NotFoundException("Không tìm thấy CV.");
        }

        if (cv.CreationMethod is not (CvCreationMethods.PlatformBuilder or CvCreationMethods.TemplateForm) || cv.StructuredContent == null)
        {
            throw new BadRequestException("CV này được tải lên từ file, không sửa bằng trình tạo CV được.", "CV_NOT_STRUCTURED");
        }

        return cv;
    }

    private async Task<CvTemplate?> TemplateAsync(Guid? id, CancellationToken cancellationToken)
    {
        if (id is not Guid templateId)
        {
            return null;
        }

        return await _templates.GetActiveByIdAsync(templateId, cancellationToken)
            ?? throw new BadRequestException("Mẫu CV không tồn tại hoặc đã ẩn.", "CV_TEMPLATE_NOT_FOUND");
    }

    private static string Title(string? title)
    {
        var text = title?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > 180)
        {
            throw new BadRequestException("Tên CV là bắt buộc và tối đa 180 ký tự.");
        }

        return text;
    }

    /// <summary>Trims everything, drops empty list entries and enforces lengths so the PDF stays readable.</summary>
    public static StructuredCvContent Validate(StructuredCvContent? content)
    {
        if (content == null)
        {
            throw new BadRequestException("structuredContent là bắt buộc.");
        }

        var fullName = content.FullName?.Trim();
        if (string.IsNullOrEmpty(fullName) || fullName.Length > MaxShort)
        {
            throw new BadRequestException($"Họ tên trong CV là bắt buộc và tối đa {MaxShort} ký tự.");
        }

        string? S(string? v, string label, int max)
        {
            var t = string.IsNullOrWhiteSpace(v) ? null : v.Trim();
            if (t?.Length > max) throw new BadRequestException($"{label} tối đa {max} ký tự.");
            return t;
        }

        IReadOnlyList<T> L<T>(IReadOnlyList<T>? items, string label)
        {
            var list = items ?? [];
            if (list.Count > MaxItems) throw new BadRequestException($"{label} tối đa {MaxItems} mục.");
            return list;
        }

        var experiences = L(content.Experiences, "Kinh nghiệm")
            .Select(e => new CvExperience(S(e.Title, "Chức danh", MaxShort), S(e.Company, "Công ty", MaxShort),
                S(e.StartDate, "Từ", 30), S(e.EndDate, "Đến", 30), S(e.Description, "Mô tả kinh nghiệm", MaxLong)))
            .Where(e => e.Title != null || e.Company != null || e.Description != null)
            .ToList();
        var educations = L(content.Educations, "Học vấn")
            .Select(e => new CvEducation(S(e.School, "Trường", MaxShort), S(e.Degree, "Bằng cấp", MaxShort),
                S(e.StartDate, "Từ", 30), S(e.EndDate, "Đến", 30), S(e.Description, "Mô tả học vấn", MaxLong)))
            .Where(e => e.School != null || e.Degree != null)
            .ToList();
        var projects = L(content.Projects, "Dự án")
            .Select(p => new CvProject(
                S(p.Name, "Tên dự án", MaxShort), S(p.Role, "Vai trò trong dự án", MaxShort),
                S(p.StartDate, "Từ", 30), S(p.EndDate, "Đến", 30),
                S(p.Description, "Mô tả dự án", MaxLong), S(p.Technologies, "Công nghệ", MaxShort),
                S(p.Url, "Liên kết dự án", 500)))
            .Where(p => p.Name != null || p.Description != null)
            .ToList();
        var activities = L(content.Activities, "Hoạt động")
            .Select(a => new CvActivity(
                S(a.Name, "Tên hoạt động", MaxShort), S(a.Role, "Vai trò trong hoạt động", MaxShort),
                S(a.StartDate, "Từ", 30), S(a.EndDate, "Đến", 30), S(a.Description, "Mô tả hoạt động", MaxLong)))
            .Where(a => a.Name != null || a.Description != null)
            .ToList();
        List<string> Words(IReadOnlyList<string>? items, string label) =>
            L(items, label).Select(i => S(i, label, MaxShort)).OfType<string>().ToList();

        CvPresentation? Presentation(CvPresentation? value)
        {
            if (value == null) return null;

            var accent = value.AccentColor?.Trim().ToUpperInvariant();
            if (accent is not { Length: 7 } || accent[0] != '#' || !accent[1..].All(Uri.IsHexDigit))
            {
                throw new BadRequestException("Màu CV phải có định dạng #RRGGBB.", "CV_PRESENTATION_INVALID");
            }

            var density = value.Density?.Trim().ToLowerInvariant();
            if (density is not ("compact" or "normal" or "spacious"))
            {
                throw new BadRequestException("Độ giãn CV không hợp lệ.", "CV_PRESENTATION_INVALID");
            }

            var font = value.FontFamily?.Trim().ToUpperInvariant();
            if (font is not ("BE_VIETNAM_PRO" or "ROBOTO" or "INTER"))
            {
                throw new BadRequestException("Font CV không được hỗ trợ.", "CV_PRESENTATION_INVALID");
            }

            var layout = value.Layout?.Trim().ToLowerInvariant();
            if (layout is not ("ats" or "classic" or "modern" or "compact" or "executive" or "elegant" or "minimal"))
            {
                throw new BadRequestException("Bố cục CV không được hỗ trợ.", "CV_PRESENTATION_INVALID");
            }

            var supportedSections = new HashSet<string>(
                ["summary", "experiences", "projects", "educations", "activities", "skills", "languages", "certificates"],
                StringComparer.OrdinalIgnoreCase);
            var sections = (value.VisibleSections ?? supportedSections.ToList())
                .Select(section => section.Trim().ToLowerInvariant())
                .Distinct()
                .ToList();
            if (sections.Count == 0 || sections.Any(section => !supportedSections.Contains(section)))
            {
                throw new BadRequestException("Danh sách mục hiển thị trong CV không hợp lệ.", "CV_PRESENTATION_INVALID");
            }

            return new CvPresentation(accent, density, font, layout, sections, value.ShowAvatar);
        }

        var result = new StructuredCvContent(
            fullName,
            S(content.Headline, "Vị trí mong muốn", MaxShort),
            S(content.Email, "Email", MaxShort),
            S(content.Phone, "Số điện thoại", 30),
            S(content.Address, "Địa chỉ", MaxShort),
            S(content.Summary, "Mục tiêu nghề nghiệp", MaxLong),
            experiences, educations, Words(content.Skills, "Kỹ năng"), Words(content.Languages, "Ngoại ngữ"),
            Words(content.Certificates, "Chứng chỉ"), Presentation(content.Presentation), projects, activities);

        // An empty CV cannot be scored by AI or read by a recruiter.
        if (result.Summary == null && experiences.Count == 0 && projects.Count == 0 && educations.Count == 0 && result.Skills!.Count == 0)
        {
            throw new BadRequestException("CV cần ít nhất một trong các mục: mục tiêu, kinh nghiệm, dự án, học vấn hoặc kỹ năng.", "CV_CONTENT_EMPTY");
        }

        return result;
    }

    private static StructuredCvDto ToDto(CandidateCv cv, StructuredCvContent content) => new(
        cv.CvId, cv.Title, cv.CreationMethod, cv.CvTemplateId, content, cv.IsPrimary, cv.Status, cv.UpdatedAt);
}
