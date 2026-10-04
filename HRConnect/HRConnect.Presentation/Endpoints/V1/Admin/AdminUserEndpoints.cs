using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Admin.Users;
using HRConnect.Application.Features.Admin.Users.Commands.ChangeUserStatus;
using HRConnect.Application.Features.Admin.Users.Commands.UnlockUser;
using HRConnect.Application.Features.Admin.Users.Queries.GetAdminUserDetail;
using HRConnect.Application.Features.Admin.Users.Queries.GetAdminUsers;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Admin;

public static class AdminUserEndpoints
{
    private const string ViewPermission = "user.view";
    private const string ManagePermission = "user.manage";

    public static IEndpointRouteBuilder MapAdminUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/users")
            .WithTags("Admin Users")
            .RequireAuthorization(policy => policy.RequireRole("PLATFORM_ADMIN"));

        group.MapGet("/", async (
            [FromQuery] string? search,
            [FromQuery] string? status,
            [FromQuery] string? role,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ViewPermission))
                return PermissionAuthorization.Forbidden(ViewPermission);

            try
            {
                var result = await sender.Send(
                    new GetAdminUsersQuery(search, status, role, page, pageSize),
                    cancellationToken);
                return Results.Ok(result);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetAdminUsers")
        .WithSummary("Xem danh sách người dùng nền tảng")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền user.view. Hỗ trợ search, status, role và phân trang.")
        .Produces<AdminUserListResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/{userId:guid}", async (
            Guid userId,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ViewPermission))
                return PermissionAuthorization.Forbidden(ViewPermission);

            try
            {
                var result = await sender.Send(new GetAdminUserDetailQuery(userId), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetAdminUserDetail")
        .WithSummary("Xem chi tiết người dùng nền tảng")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền user.view. Không trả password hash, token hoặc security stamp.")
        .Produces<AdminUserDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        group.MapPatch("/{userId:guid}/status", async (
            Guid userId,
            [FromBody] ChangeAdminUserStatusRequest request,
            [FromServices] ISender sender,
            [FromServices] IValidator<ChangeUserStatusCommand> validator,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ManagePermission))
                return PermissionAuthorization.Forbidden(ManagePermission);

            var actorUserId = GetUserId(user);
            if (!actorUserId.HasValue) return Results.Unauthorized();

            var command = new ChangeUserStatusCommand(userId, actorUserId.Value, request.Status, request.Reason);
            var validation = await validator.ValidateAsync(command, cancellationToken);
            if (!validation.IsValid) return ValidationProblem(validation);

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("ChangeAdminUserStatus")
        .WithSummary("Tạm khóa hoặc kích hoạt lại người dùng")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền user.manage. Chỉ cho phép ACTIVE ↔ SUSPENDED; không áp dụng cho PLATFORM_ADMIN hoặc tài khoản PENDING.")
        .Produces<AdminUserActionResponse>(StatusCodes.Status200OK)
        .ProducesValidationProblem()
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/{userId:guid}/unlock", async (
            Guid userId,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ManagePermission))
                return PermissionAuthorization.Forbidden(ManagePermission);

            var actorUserId = GetUserId(user);
            if (!actorUserId.HasValue) return Results.Unauthorized();

            try
            {
                var result = await sender.Send(new UnlockUserCommand(userId, actorUserId.Value), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
            }
        })
        .WithName("UnlockAdminUserLogin")
        .WithSummary("Mở khóa đăng nhập cho người dùng")
        .WithDescription("Chỉ PLATFORM_ADMIN có quyền user.manage. Chỉ xóa lockout đăng nhập; không thay đổi AppUser.Status.")
        .Produces<AdminUserActionResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static Guid? GetUserId(ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    private static IResult ValidationProblem(FluentValidation.Results.ValidationResult validationResult) =>
        Results.ValidationProblem(validationResult.Errors
            .GroupBy(error => error.PropertyName)
            .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage).ToArray()));
}

public sealed record ChangeAdminUserStatusRequest(string Status, string? Reason);
