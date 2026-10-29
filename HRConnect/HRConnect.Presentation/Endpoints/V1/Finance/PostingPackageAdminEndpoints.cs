using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.PostingPackages;
using HRConnect.Application.Features.Jobs.Queries.GetJobPostingPackages;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Finance;

/// <summary>Admin › Cài đặt: the CV_APPLICATION posting packages (price, display days, max CVs, on/off).</summary>
public static class PostingPackageAdminEndpoints
{
    private const string View = "system_config.view";
    private const string Manage = "system_config.manage";

    public sealed record UpdatePostingPackageRequest(
        string Name, string? Description, decimal Price, int DurationDays, int? MaxApplications, bool IsActive);

    public static IEndpointRouteBuilder MapPostingPackageAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/posting-packages").WithTags("Admin Business Settings").RequireAuthorization();

        group.MapGet("", async (ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            !Allowed(user, View) && !Allowed(user, Manage)
                ? PermissionAuthorization.Forbidden(View)
                : Results.Ok(new { success = true, data = await sender.Send(new GetJobPostingPackagesQuery(ActiveOnly: false), ct) }))
            .WithName("GetAdminPostingPackages")
            .WithSummary("Danh sách gói đăng tin CV_APPLICATION, kể cả gói đang tắt")
            .WithDescription("Quyền system_config.view.");

        group.MapPut("/{packageId:guid}", async (
                Guid packageId, [FromBody] UpdatePostingPackageRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
        {
            var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
            if (!Guid.TryParse(idClaim, out var userId))
            {
                return Results.Unauthorized();
            }

            if (!Allowed(user, Manage))
            {
                return PermissionAuthorization.Forbidden(Manage);
            }

            try
            {
                var command = new UpdatePostingPackageCommand(
                    packageId, body.Name, body.Description, body.Price, body.DurationDays, body.MaxApplications, body.IsActive, userId);
                return Results.Ok(new { success = true, data = await sender.Send(command, ct) });
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
            .WithName("UpdatePostingPackage")
            .WithSummary("Admin sửa một gói đăng tin CV_APPLICATION")
            .WithDescription("Giá, số ngày hiển thị và số hồ sơ tối đa mới áp dụng cho tin gửi duyệt sau đó; phí đăng tin đã tạo giữ nguyên số tiền. Quyền system_config.manage; có ghi audit.");

        return app;
    }

    private static bool Allowed(ClaimsPrincipal user, string permission) =>
        user.IsInRole("PLATFORM_ADMIN") || PermissionAuthorization.HasPermission(user, permission);
}
