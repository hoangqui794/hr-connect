using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Settings;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Finance;

/// <summary>Admin-configurable business numbers (fee multiplier, warranty days, payment due days, ...).</summary>
public static class BusinessSettingEndpoints
{
    private const string View = "system_config.view";
    private const string Manage = "system_config.manage";

    public sealed record UpdateBusinessSettingRequest(decimal Value);

    public static IEndpointRouteBuilder MapBusinessSettingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/settings").WithTags("Admin Business Settings").RequireAuthorization();

        group.MapGet("", async (ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            !Allowed(user, View) && !Allowed(user, Manage)
                ? PermissionAuthorization.Forbidden(View)
                : Results.Ok(new { success = true, data = await sender.Send(new GetBusinessSettingsQuery(), ct) }))
            .WithName("GetBusinessSettings")
            .WithSummary("Danh sách con số nghiệp vụ cấu hình được")
            .WithDescription("Mỗi mục có giá trị hiện tại, mặc định theo tài liệu, khoảng cho phép và người sửa gần nhất. Quyền system_config.view.");

        group.MapPut("/{key}", async (
                string key, [FromBody] UpdateBusinessSettingRequest body, ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
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
                return Results.Ok(new { success = true, data = await sender.Send(new UpdateBusinessSettingCommand(key, body.Value, userId), ct) });
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
            .WithName("UpdateBusinessSetting")
            .WithSummary("Admin đổi một con số nghiệp vụ")
            .WithDescription("Giá trị mới áp dụng cho các bản ghi tạo sau đó (khoản phí, bảo hành đã tạo giữ nguyên số cũ). Quyền system_config.manage; có ghi audit.");

        return app;
    }

    private static bool Allowed(ClaimsPrincipal user, string permission) =>
        user.IsInRole("PLATFORM_ADMIN") || PermissionAuthorization.HasPermission(user, permission);
}
