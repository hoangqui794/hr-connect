using HRConnect.Presentation.ErrorHandling;
using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Companies.Directory;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Companies;

/// <summary>BE-02 A + B: industry taxonomy, company sizes, public company directory and Top Companies.</summary>
public static class CompanyDirectoryEndpoints
{
    private const string AdminPermission = "system_config.manage";

    public sealed record IndustryRequest(string? Code, string NameEn, string? NameVi, Guid? ParentId, int SortOrder = 0, bool IsActive = true);

    public sealed record FeaturedRequest(bool IsFeatured, int? FeaturedOrder);

    public static IEndpointRouteBuilder MapCompanyDirectoryEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/industries", (int? level, Guid? parentId, string? search, bool? tree, [FromServices] ISender sender, CancellationToken ct) =>
                Run(() => sender.Send(new GetIndustriesQuery(level, parentId, search, tree == true), ct)))
            .AllowAnonymous().RequireRateLimiting("public-read").WithTags("Industries")
            .WithName("GetIndustries")
            .WithSummary("Danh sách ngành (công khai)")
            .WithDescription("Ngành đang bật. Lọc level (1-3), parentId, search (tên hoặc mã). tree=true trả dạng cây cấp 1 → 2 → 3 (bỏ qua bộ lọc khác).");

        app.MapGet("/api/v1/company-sizes", ([FromServices] ISender sender, CancellationToken ct) =>
                Run(() => sender.Send(new GetCompanySizesQuery(), ct)))
            .AllowAnonymous().RequireRateLimiting("public-read").WithTags("Industries")
            .WithName("GetCompanySizes")
            .WithSummary("Danh sách quy mô công ty (công khai)");

        var admin = app.MapGroup("/api/v1/admin").WithTags("Admin Industries & Top Companies").RequireAuthorization();

        admin.MapGet("/industries", (ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Admin(user, _ => sender.Send(new GetIndustriesQuery(null, null, null, true, IncludeInactive: true), ct)))
            .WithName("AdminGetIndustries").WithSummary("Cây ngành gồm cả ngành đã tắt (Platform Admin)");

        admin.MapPost("/industries", ([FromBody] IndustryRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Admin(user, userId => sender.Send(new CreateIndustryCommand(body.Code ?? string.Empty, body.NameEn, body.NameVi, body.ParentId, body.SortOrder, userId), ct)))
            .WithName("CreateIndustry")
            .WithSummary("Thêm ngành (Platform Admin)")
            .WithDescription("code duy nhất (chữ thường); parentId để trống là ngành cấp 1, cấp tự tính theo ngành cha, tối đa 3 cấp (400 INDUSTRY_TOO_DEEP). Mã đã có → 409.");

        admin.MapPut("/industries/{industryId:guid}", (Guid industryId, [FromBody] IndustryRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Admin(user, userId => sender.Send(new UpdateIndustryCommand(industryId, body.NameEn, body.NameVi, body.SortOrder, body.IsActive, userId), ct)))
            .WithName("UpdateIndustry")
            .WithSummary("Sửa tên, thứ tự, bật/tắt ngành (Platform Admin)")
            .WithDescription("Không xóa cứng: ngành tắt (isActive=false) không hiện cho người dùng nhưng công ty đã gắn vẫn giữ. Có audit.");

        admin.MapPut("/companies/{companyId:guid}/featured", (Guid companyId, [FromBody] FeaturedRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
                Admin(user, userId => sender.Send(new SetCompanyFeaturedCommand(companyId, body.IsFeatured, body.FeaturedOrder, userId), ct)))
            .WithName("SetCompanyFeatured")
            .WithSummary("Đưa công ty vào / bỏ khỏi Top Companies (Platform Admin)")
            .WithDescription("{ isFeatured, featuredOrder (1-1000) }. Chỉ công ty VERIFIED (400 COMPANY_NOT_VERIFIED). Có audit.");

        var directory = app.MapGroup("/api/v1/public/companies").WithTags("Public Companies").AllowAnonymous().RequireRateLimiting("public-read");

        directory.MapGet("", (string? search, Guid? industryId, Guid? companySizeId, string? location, int? page, int? pageSize,
                [FromServices] ISender sender, CancellationToken ct) =>
                Run(() => sender.Send(new SearchCompaniesQuery(search, industryId, companySizeId, location,
                    page is > 0 ? page.Value : 1, pageSize is > 0 ? pageSize.Value : 20), ct)))
            .WithName("SearchPublicCompanies")
            .WithSummary("Danh bạ công ty công khai")
            .WithDescription("Chỉ công ty VERIFIED. search theo tên, industryId (ngành cấp 1/2 lấy cả ngành con), companySizeId, location (theo địa chỉ). pageSize tối đa 50. Công ty nổi bật lên trước. activeJobCount đếm job ACTIVE mà ứng viên được xem. Không trả mã số thuế.");

        directory.MapGet("/featured", ([FromServices] ISender sender, CancellationToken ct) =>
                Run(() => sender.Send(new GetFeaturedCompaniesQuery(), ct)))
            .WithName("GetFeaturedCompanies")
            .WithSummary("Top Companies theo thứ tự Admin chọn");

        directory.MapGet("/{companyId:guid}", (Guid companyId, [FromServices] ISender sender, CancellationToken ct) =>
                Run(() => sender.Send(new GetPublicCompanyQuery(companyId), ct)))
            .WithName("GetPublicCompany")
            .WithSummary("Hồ sơ công ty công khai và các job đang tuyển")
            .WithDescription("Công ty chưa VERIFIED → 404. jobs chỉ gồm job ACTIVE thuộc Service Type mà vai trò Candidate có can_view.");

        return app;
    }

    private static async Task<IResult> Run<T>(Func<Task<T>> action)
    {
        try
        {
            return Results.Ok(new { success = true, data = await action() });
        }
        catch (NotFoundException ex)
        {
            return Results.NotFound(new { success = false, message = ex.Message });
        }
        catch (BadRequestException ex)
        {
            return Results.BadRequest(new { success = false, code = ex.ErrorCode, message = ex.Message });
        }
        catch (ConflictException ex)
        {
            return ConflictResponse.From(ex);
        }
    }

    private static Task<IResult> Admin<T>(ClaimsPrincipal user, Func<Guid, Task<T>> action)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(idClaim, out var userId)) return Task.FromResult(Results.Unauthorized());
        if (!user.IsInRole("PLATFORM_ADMIN") && !PermissionAuthorization.HasPermission(user, AdminPermission))
            return Task.FromResult(PermissionAuthorization.Forbidden(AdminPermission));
        return Run(() => action(userId));
    }
}
