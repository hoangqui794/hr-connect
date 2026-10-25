using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Companies.Directory;

// ---------- BE-02 A: industries and company sizes ----------

public sealed record IndustryDto(
    Guid IndustryId, string Code, string NameEn, string? NameVi, int Level, Guid? ParentId, int SortOrder, bool IsActive,
    IReadOnlyList<IndustryDto>? Children = null);

public sealed record CompanySizeDto(Guid CompanySizeId, string Code, string Label, int MinEmployees, int? MaxEmployees);

public sealed record IndustryRefDto(Guid IndustryId, string Name);

public sealed record CompanySizeRefDto(Guid CompanySizeId, string Label);

// ---------- BE-02 B: public company directory ----------

public sealed record CompanyDirectoryItemDto(
    Guid CompanyId, string CompanyName, string? LogoUrl, IndustryRefDto? Industry, CompanySizeRefDto? CompanySize,
    string? Website, string? Address, string? Description, bool IsFeatured, int? FeaturedOrder, int ActiveJobCount);

public sealed record CompanyDirectoryPageDto(IReadOnlyList<CompanyDirectoryItemDto> Items, int Page, int PageSize, int TotalCount, int TotalPages);

public sealed record CompanyDirectoryDetailDto(CompanyDirectoryItemDto Company, IReadOnlyList<JobDto> Jobs);

public sealed record CompanyDirectoryFilter(
    string? Search, IReadOnlyCollection<Guid>? IndustryIds, Guid? CompanySizeId, string? Location, int Page, int PageSize);

public interface ICompanyDirectoryRepository
{
    Task<IReadOnlyList<Industry>> GetIndustriesAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<Industry?> GetIndustryAsync(Guid industryId, CancellationToken cancellationToken = default);
    Task<bool> IndustryCodeExistsAsync(string code, CancellationToken cancellationToken = default);
    Task AddIndustryAsync(Industry industry, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CompanySizeOption>> GetActiveCompanySizesAsync(CancellationToken cancellationToken = default);
    Task<CompanySizeOption?> GetCompanySizeAsync(Guid companySizeId, CancellationToken cancellationToken = default);

    /// <summary>VERIFIED companies matching the filter, with the number of ACTIVE jobs the given roles may view.</summary>
    Task<(IReadOnlyList<(Company Company, int ActiveJobCount)> Items, int TotalCount)> SearchVerifiedAsync(
        CompanyDirectoryFilter filter, IReadOnlyCollection<string> roleCodes, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<(Company Company, int ActiveJobCount)>> GetFeaturedAsync(
        IReadOnlyCollection<string> roleCodes, CancellationToken cancellationToken = default);

    Task<(Company Company, IReadOnlyList<Job> Jobs)?> GetVerifiedWithJobsAsync(
        Guid companyId, IReadOnlyCollection<string> roleCodes, CancellationToken cancellationToken = default);

    Task<Company?> GetCompanyForUpdateAsync(Guid companyId, CancellationToken cancellationToken = default);
}

public sealed record GetIndustriesQuery(int? Level, Guid? ParentId, string? Search, bool Tree, bool IncludeInactive = false)
    : IRequest<IReadOnlyList<IndustryDto>>;

public sealed record GetCompanySizesQuery : IRequest<IReadOnlyList<CompanySizeDto>>;

public sealed record CreateIndustryCommand(string Code, string NameEn, string? NameVi, Guid? ParentId, int SortOrder, Guid UserId)
    : IRequest<IndustryDto>;

public sealed record UpdateIndustryCommand(Guid IndustryId, string NameEn, string? NameVi, int SortOrder, bool IsActive, Guid UserId)
    : IRequest<IndustryDto>;

public sealed record SearchCompaniesQuery(
    string? Search, Guid? IndustryId, Guid? CompanySizeId, string? Location, int Page = 1, int PageSize = 20)
    : IRequest<CompanyDirectoryPageDto>;

public sealed record GetFeaturedCompaniesQuery : IRequest<IReadOnlyList<CompanyDirectoryItemDto>>;

public sealed record GetPublicCompanyQuery(Guid CompanyId) : IRequest<CompanyDirectoryDetailDto>;

public sealed record SetCompanyFeaturedCommand(Guid CompanyId, bool IsFeatured, int? FeaturedOrder, Guid UserId)
    : IRequest<CompanyDirectoryItemDto>;

public sealed class CompanyDirectoryHandlers :
    IRequestHandler<GetIndustriesQuery, IReadOnlyList<IndustryDto>>,
    IRequestHandler<GetCompanySizesQuery, IReadOnlyList<CompanySizeDto>>,
    IRequestHandler<CreateIndustryCommand, IndustryDto>,
    IRequestHandler<UpdateIndustryCommand, IndustryDto>,
    IRequestHandler<SearchCompaniesQuery, CompanyDirectoryPageDto>,
    IRequestHandler<GetFeaturedCompaniesQuery, IReadOnlyList<CompanyDirectoryItemDto>>,
    IRequestHandler<GetPublicCompanyQuery, CompanyDirectoryDetailDto>,
    IRequestHandler<SetCompanyFeaturedCommand, CompanyDirectoryItemDto>
{
    /// <summary>The directory is public: guests see what the Candidate role may see.</summary>
    private static readonly IReadOnlyCollection<string> PublicRoles = [JobAccessPolicy.CandidateRole];

    private readonly ICompanyDirectoryRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;
    private readonly ICompanyLogoUrlResolver? _logoUrlResolver;

    public CompanyDirectoryHandlers(ICompanyDirectoryRepository repository, IUnitOfWork unitOfWork, IAuditLogService audit,
        ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _audit = audit;
        _logoUrlResolver = logoUrlResolver;
    }

    public async Task<IReadOnlyList<IndustryDto>> Handle(GetIndustriesQuery request, CancellationToken cancellationToken)
    {
        var all = await _repository.GetIndustriesAsync(request.IncludeInactive, cancellationToken);
        if (request.Tree)
        {
            var byParent = all.ToLookup(i => i.ParentId);
            IReadOnlyList<IndustryDto> Build(Guid? parentId) =>
                byParent[parentId].OrderBy(i => i.SortOrder).ThenBy(i => i.NameEn)
                    .Select(i => ToDto(i) with { Children = Build(i.IndustryId) }).ToList();
            return Build(null);
        }

        IEnumerable<Industry> query = all;
        if (request.Level.HasValue) query = query.Where(i => i.Level == request.Level.Value);
        if (request.ParentId.HasValue) query = query.Where(i => i.ParentId == request.ParentId.Value);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim();
            query = query.Where(i => i.NameEn.Contains(search, StringComparison.OrdinalIgnoreCase)
                                     || (i.NameVi?.Contains(search, StringComparison.OrdinalIgnoreCase) ?? false)
                                     || i.Code.Contains(search, StringComparison.OrdinalIgnoreCase));
        }
        return query.OrderBy(i => i.Level).ThenBy(i => i.SortOrder).ThenBy(i => i.NameEn).Select(i => ToDto(i)).ToList();
    }

    public async Task<IReadOnlyList<CompanySizeDto>> Handle(GetCompanySizesQuery request, CancellationToken cancellationToken) =>
        (await _repository.GetActiveCompanySizesAsync(cancellationToken))
        .Select(s => new CompanySizeDto(s.CompanySizeId, s.Code, s.Label, s.MinEmployees, s.MaxEmployees)).ToList();

    public async Task<IndustryDto> Handle(CreateIndustryCommand request, CancellationToken cancellationToken)
    {
        var code = Required(request.Code, "code", 100).ToLowerInvariant();
        if (await _repository.IndustryCodeExistsAsync(code, cancellationToken))
            throw new ConflictException($"Mã ngành '{code}' đã tồn tại.");

        short level = 1;
        if (request.ParentId.HasValue)
        {
            var parent = await _repository.GetIndustryAsync(request.ParentId.Value, cancellationToken)
                ?? throw new BadRequestException("Không tìm thấy ngành cha.", "INDUSTRY_NOT_FOUND");
            if (parent.Level >= 3) throw new BadRequestException("Cây ngành tối đa 3 cấp.", "INDUSTRY_TOO_DEEP");
            level = (short)(parent.Level + 1);
        }

        var now = DateTime.UtcNow;
        var industry = new Industry
        {
            IndustryId = Guid.NewGuid(),
            Code = code,
            NameEn = Required(request.NameEn, "nameEn", 200),
            NameVi = Optional(request.NameVi, 200),
            Level = level,
            ParentId = request.ParentId,
            SortOrder = request.SortOrder,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _repository.AddIndustryAsync(industry, cancellationToken);
        await AuditAsync(AuditActions.IndustryChanged, "INDUSTRY", industry.IndustryId, request.UserId,
            new { industry.Code, industry.NameEn, industry.NameVi, industry.Level, industry.ParentId, change = "CREATED" }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToDto(industry);
    }

    public async Task<IndustryDto> Handle(UpdateIndustryCommand request, CancellationToken cancellationToken)
    {
        var industry = await _repository.GetIndustryAsync(request.IndustryId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy ngành.");
        industry.NameEn = Required(request.NameEn, "nameEn", 200);
        industry.NameVi = Optional(request.NameVi, 200);
        industry.SortOrder = request.SortOrder;
        industry.IsActive = request.IsActive; // turned off, not deleted: companies keep their reference
        industry.UpdatedAt = DateTime.UtcNow;
        await AuditAsync(AuditActions.IndustryChanged, "INDUSTRY", industry.IndustryId, request.UserId,
            new { industry.NameEn, industry.NameVi, industry.SortOrder, industry.IsActive, change = "UPDATED" }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToDto(industry);
    }

    public async Task<CompanyDirectoryPageDto> Handle(SearchCompaniesQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 50);
        IReadOnlyCollection<Guid>? industryIds = null;
        if (request.IndustryId.HasValue)
        {
            // An L1/L2 industry also matches companies in the industries below it.
            var all = await _repository.GetIndustriesAsync(includeInactive: true, cancellationToken);
            industryIds = Descendants(all, request.IndustryId.Value);
        }

        var (items, total) = await _repository.SearchVerifiedAsync(
            new CompanyDirectoryFilter(request.Search?.Trim(), industryIds, request.CompanySizeId, request.Location?.Trim(), page, pageSize),
            PublicRoles, cancellationToken);
        return new CompanyDirectoryPageDto(
            items.Select(x => ToItem(x.Company, x.ActiveJobCount, _logoUrlResolver)).ToList(), page, pageSize, total,
            (int)Math.Ceiling(total / (double)pageSize));
    }

    public async Task<IReadOnlyList<CompanyDirectoryItemDto>> Handle(GetFeaturedCompaniesQuery request, CancellationToken cancellationToken) =>
        (await _repository.GetFeaturedAsync(PublicRoles, cancellationToken)).Select(x => ToItem(x.Company, x.ActiveJobCount, _logoUrlResolver)).ToList();

    public async Task<CompanyDirectoryDetailDto> Handle(GetPublicCompanyQuery request, CancellationToken cancellationToken)
    {
        var result = await _repository.GetVerifiedWithJobsAsync(request.CompanyId, PublicRoles, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy công ty.");
        return new CompanyDirectoryDetailDto(
            ToItem(result.Company, result.Jobs.Count, _logoUrlResolver),
            result.Jobs.Select(job => JobDto.From(job, logoUrlResolver: _logoUrlResolver)).ToList());
    }

    public async Task<CompanyDirectoryItemDto> Handle(SetCompanyFeaturedCommand request, CancellationToken cancellationToken)
    {
        if (request.FeaturedOrder is < 1 or > 1000)
            throw new BadRequestException("featuredOrder phải từ 1 đến 1000.");
        var company = await _repository.GetCompanyForUpdateAsync(request.CompanyId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy công ty.");
        if (request.IsFeatured && !string.Equals(company.VerificationStatus, "VERIFIED", StringComparison.OrdinalIgnoreCase))
            throw new BadRequestException("Chỉ công ty đã xác minh mới được đưa vào Top Companies.", "COMPANY_NOT_VERIFIED");

        var old = new { company.IsFeatured, company.FeaturedOrder };
        company.IsFeatured = request.IsFeatured;
        company.FeaturedOrder = request.IsFeatured ? request.FeaturedOrder : null;
        company.UpdatedAt = DateTime.UtcNow;
        await AuditAsync(AuditActions.CompanyFeaturedChanged, "COMPANY", company.CompanyId, request.UserId,
            new { company.IsFeatured, company.FeaturedOrder }, cancellationToken, old);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToItem(company, 0, _logoUrlResolver);
    }

    public static IReadOnlyCollection<Guid> Descendants(IReadOnlyList<Industry> all, Guid rootId)
    {
        var byParent = all.ToLookup(i => i.ParentId);
        var result = new HashSet<Guid> { rootId };
        var queue = new Queue<Guid>([rootId]);
        while (queue.Count > 0)
        {
            foreach (var child in byParent[queue.Dequeue()])
            {
                if (result.Add(child.IndustryId)) queue.Enqueue(child.IndustryId);
            }
        }
        return result;
    }

    public static CompanyDirectoryItemDto ToItem(Company company, int activeJobCount, ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        var website = company.Website?.Trim();
        if (!string.IsNullOrEmpty(website) && !website.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            && !website.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            website = "https://" + website;
        }

        return new CompanyDirectoryItemDto(
            company.CompanyId, company.CompanyName, logoUrlResolver?.Resolve(company) ?? company.LogoUrl,
            company.IndustryRef == null ? null : new IndustryRefDto(company.IndustryRef.IndustryId, company.IndustryRef.NameVi ?? company.IndustryRef.NameEn),
            company.CompanySizeRef == null ? null : new CompanySizeRefDto(company.CompanySizeRef.CompanySizeId, company.CompanySizeRef.Label),
            string.IsNullOrEmpty(website) ? null : website, company.Address, company.Description,
            company.IsFeatured, company.FeaturedOrder, activeJobCount);
    }

    private static IndustryDto ToDto(Industry i) =>
        new(i.IndustryId, i.Code, i.NameEn, i.NameVi, i.Level, i.ParentId, i.SortOrder, i.IsActive);

    private Task AuditAsync(string action, string entityType, Guid entityId, Guid userId, object newValues,
        CancellationToken cancellationToken, object? oldValues = null) =>
        _audit.AddAsync(new AuditEntry
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            ActorUserId = userId,
            OldValues = oldValues,
            NewValues = newValues,
        }, cancellationToken);

    private static string Required(string? value, string field, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) throw new BadRequestException($"{field} là bắt buộc.");
        if (trimmed.Length > max) throw new BadRequestException($"{field} tối đa {max} ký tự.");
        return trimmed;
    }

    private static string? Optional(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > max) throw new BadRequestException($"Tối đa {max} ký tự.");
        return trimmed;
    }
}
