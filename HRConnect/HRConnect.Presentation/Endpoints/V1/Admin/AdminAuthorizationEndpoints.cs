using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Admin.Authorization;
using HRConnect.Presentation.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Admin;

public static class AdminAuthorizationEndpoints
{
    private const string RoleView = "role.view";
    private const string RoleManage = "role.manage";
    private const string PermissionView = "permission.view";
    private const string PermissionManage = "permission.manage";

    public static IEndpointRouteBuilder MapAdminAuthorizationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/authorization")
            .WithTags("Admin Authorization")
            .RequireAuthorization(policy => policy.RequireRole("PLATFORM_ADMIN"));

        group.MapGet("/permissions", async (
            [FromQuery] string? search, [FromQuery] string? resource, [FromQuery] string? action,
            [FromQuery] bool? isActive, [FromQuery] bool? isDelegable,
            [FromQuery] int page, [FromQuery] int pageSize,
            IAuthorizationAdminService service, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, PermissionView)) return PermissionAuthorization.Forbidden(PermissionView);
            var data = await service.GetPermissionsAsync(search, resource, action, isActive, isDelegable,
                page <= 0 ? 1 : page, pageSize <= 0 ? 20 : pageSize, ct);
            return Results.Ok(new { success = true, data });
        }).WithName("GetAdminPermissions").WithSummary("Xem danh mục quyền hệ thống")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status401Unauthorized).Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/permissions/{permissionId:guid}", async (
            Guid permissionId, IAuthorizationAdminService service, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, PermissionView)) return PermissionAuthorization.Forbidden(PermissionView);
            return await Execute(() => service.GetPermissionAsync(permissionId, ct));
        }).WithName("GetAdminPermissionDetail").WithSummary("Xem chi tiết quyền hệ thống")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound);

        group.MapPatch("/permissions/{permissionId:guid}", async (
            Guid permissionId, UpdatePermissionRequest request, IAuthorizationAdminService service,
            ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, PermissionManage)) return PermissionAuthorization.Forbidden(PermissionManage);
            var actor = UserId(user); if (!actor.HasValue) return Results.Unauthorized();
            return await Execute(() => service.UpdatePermissionAsync(permissionId, request, actor.Value, ct));
        }).WithName("UpdateAdminPermission").WithSummary("Cập nhật mô tả hoặc trạng thái quyền")
          .WithDescription("Không cho đổi code/resource/action hoặc vô hiệu hóa quyền IAM được bảo vệ.")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status400BadRequest)
          .Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound).Produces(StatusCodes.Status409Conflict);

        group.MapGet("/roles", async (
            [FromQuery] string? search, [FromQuery] bool? isSystem, [FromQuery] bool? isActive,
            [FromQuery] int page, [FromQuery] int pageSize,
            IAuthorizationAdminService service, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleView)) return PermissionAuthorization.Forbidden(RoleView);
            var data = await service.GetRolesAsync(search, isSystem, isActive,
                page <= 0 ? 1 : page, pageSize <= 0 ? 20 : pageSize, ct);
            return Results.Ok(new { success = true, data });
        }).WithName("GetAdminRoles").WithSummary("Xem danh sách vai trò")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/roles/{roleId:guid}", async (
            Guid roleId, IAuthorizationAdminService service, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleView)) return PermissionAuthorization.Forbidden(RoleView);
            return await Execute(() => service.GetRoleAsync(roleId, ct));
        }).WithName("GetAdminRoleDetail").WithSummary("Xem chi tiết vai trò và quyền")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound);

        group.MapPost("/roles", async (
            CreateRoleRequest request, IAuthorizationAdminService service, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleManage)) return PermissionAuthorization.Forbidden(RoleManage);
            var actor = UserId(user); if (!actor.HasValue) return Results.Unauthorized();
            return await Execute(() => service.CreateRoleAsync(request, actor.Value, ct), StatusCodes.Status201Created);
        }).WithName("CreateAdminCustomRole").WithSummary("Tạo vai trò tùy chỉnh")
          .Produces(StatusCodes.Status201Created).Produces(StatusCodes.Status400BadRequest).Produces(StatusCodes.Status409Conflict);

        group.MapPatch("/roles/{roleId:guid}", async (
            Guid roleId, UpdateRoleRequest request, IAuthorizationAdminService service,
            ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleManage)) return PermissionAuthorization.Forbidden(RoleManage);
            var actor = UserId(user); if (!actor.HasValue) return Results.Unauthorized();
            return await Execute(() => service.UpdateRoleAsync(roleId, request, actor.Value, ct));
        }).WithName("UpdateAdminCustomRole").WithSummary("Cập nhật vai trò tùy chỉnh")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status400BadRequest)
          .Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound).Produces(StatusCodes.Status409Conflict);

        group.MapDelete("/roles/{roleId:guid}", async (
            Guid roleId, [FromBody] DeleteRoleRequest request, IAuthorizationAdminService service,
            ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleManage)) return PermissionAuthorization.Forbidden(RoleManage);
            var actor = UserId(user); if (!actor.HasValue) return Results.Unauthorized();
            return await Execute(() => service.DeleteRoleAsync(roleId, request, actor.Value, ct));
        }).WithName("DeleteAdminCustomRole").WithSummary("Ngừng sử dụng vai trò tùy chỉnh")
          .WithDescription("Soft delete; vai trò đang được gán phải được thu hồi trước.")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status403Forbidden)
          .Produces(StatusCodes.Status404NotFound).Produces(StatusCodes.Status409Conflict);

        group.MapPut("/roles/{roleId:guid}/permissions", async (
            Guid roleId, ReplaceRolePermissionsRequest request, IAuthorizationAdminService service,
            ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, PermissionManage)) return PermissionAuthorization.Forbidden(PermissionManage);
            var actor = UserId(user); if (!actor.HasValue) return Results.Unauthorized();
            return await Execute(() => service.ReplaceRolePermissionsAsync(roleId, request, actor.Value, ct));
        }).WithName("ReplaceAdminCustomRolePermissions").WithSummary("Thay thế toàn bộ quyền của vai trò tùy chỉnh")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status400BadRequest)
          .Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound).Produces(StatusCodes.Status409Conflict);

        group.MapGet("/users/{userId:guid}", async (
            Guid userId, IAuthorizationAdminService service, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleView)) return PermissionAuthorization.Forbidden(RoleView);
            return await Execute(() => service.GetUserAuthorizationAsync(userId, ct));
        }).WithName("GetAdminUserAuthorization").WithSummary("Xem quyền hiệu lực và nguồn quyền của người dùng")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound);

        group.MapPost("/users/{userId:guid}/roles", async (
            Guid userId, AssignUserRoleRequest request, IAuthorizationAdminService service,
            ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleManage)) return PermissionAuthorization.Forbidden(RoleManage);
            var actor = UserId(user); if (!actor.HasValue) return Results.Unauthorized();
            return await Execute(() => service.AssignUserRoleAsync(userId, request, actor.Value, ct));
        }).WithName("AssignAdminUserCustomRole").WithSummary("Gán vai trò tùy chỉnh cho người dùng")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status400BadRequest)
          .Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound).Produces(StatusCodes.Status409Conflict);

        group.MapDelete("/users/{userId:guid}/roles/{roleId:guid}", async (
            Guid userId, Guid roleId, [FromBody] RevokeUserRoleRequest request,
            IAuthorizationAdminService service, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (!PermissionAuthorization.HasPermission(user, RoleManage)) return PermissionAuthorization.Forbidden(RoleManage);
            var actor = UserId(user); if (!actor.HasValue) return Results.Unauthorized();
            return await Execute(() => service.RevokeUserRoleAsync(userId, roleId, request, actor.Value, ct));
        }).WithName("RevokeAdminUserCustomRole").WithSummary("Thu hồi vai trò tùy chỉnh của người dùng")
          .Produces(StatusCodes.Status200OK).Produces(StatusCodes.Status400BadRequest)
          .Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound).Produces(StatusCodes.Status409Conflict);

        return app;
    }

    private static async Task<IResult> Execute<T>(Func<Task<T>> action, int successStatus = StatusCodes.Status200OK)
    {
        try { return Results.Json(new { success = true, data = await action() }, statusCode: successStatus); }
        catch (BadRequestException ex) { return Problem(StatusCodes.Status400BadRequest, ex.Message, ex.ErrorCode); }
        catch (ForbiddenException ex) { return Problem(StatusCodes.Status403Forbidden, ex.Message, ex.ErrorCode); }
        catch (NotFoundException ex) { return Problem(StatusCodes.Status404NotFound, ex.Message, "NOT_FOUND"); }
        catch (ConflictException ex) { return Problem(StatusCodes.Status409Conflict, ex.Message, ex.ErrorCode, ex.Details); }
    }

    private static IResult Problem(int status, string message, string? code,
        IReadOnlyDictionary<string, object?>? details = null) =>
        Results.Json(new { success = false, message, errorCode = code, details }, statusCode: status);

    private static Guid? UserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
