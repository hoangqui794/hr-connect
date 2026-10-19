using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Users.Commands.DeleteAvatar;
using HRConnect.Application.Features.Users.Commands.UploadAvatar;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace HRConnect.Presentation.Endpoints.V1.Users;

public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users")
                       .WithTags("Users");

        group.MapPost("/me/avatar", HandleAvatarUploadAsync)
        .RequireAuthorization()
        .DisableAntiforgery()
        .WithName("UploadUserAvatar")
        .WithSummary("Tải lên ảnh đại diện cho người dùng hiện tại")
        .WithDescription("Hỗ trợ tải lên ảnh đại diện cho bất kỳ người dùng đã đăng nhập (Candidate, Affiliate, Company User, Internal HR, Platform Admin). Ảnh được lưu trữ trên Cloudflare R2 và tự động cập nhật URL vào hồ sơ người dùng.")
        .Produces<UploadAvatarResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status413PayloadTooLarge)
        .Produces(StatusCodes.Status415UnsupportedMediaType)
        .Produces(StatusCodes.Status422UnprocessableEntity)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        group.MapPost("/avatar", async (HttpContext context, IFormFile? file, ISender sender,
                IValidator<UploadAvatarCommand> validator, CancellationToken cancellationToken) =>
            {
                context.Response.Headers.Append("Deprecation", "true");
                context.Response.Headers.Append("Sunset", "Sat, 31 Oct 2027 00:00:00 GMT");
                context.Response.Headers.Append("Link", "</api/v1/users/me/avatar>; rel=\"successor-version\"");
                return await HandleAvatarUploadAsync(context.User, file, sender, validator, cancellationToken);
            })
        .RequireAuthorization()
        .DisableAntiforgery()
        .WithName("UploadUserAvatarAlias")
        .WithSummary("Tải lên ảnh đại diện cho người dùng hiện tại (Alias)")
        .WithDescription("Đường dẫn cũ, sẽ được loại bỏ sau giai đoạn chuyển tiếp. Dùng /api/v1/users/me/avatar.")
        .Produces<UploadAvatarResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status413PayloadTooLarge)
        .Produces(StatusCodes.Status415UnsupportedMediaType)
        .Produces(StatusCodes.Status422UnprocessableEntity)
        .Produces(StatusCodes.Status503ServiceUnavailable);

        // 2. GET /api/v1/users/{userId:guid}/avatar - Xem ảnh đại diện của người dùng
        group.MapGet("/{userId:guid}/avatar", async (
            Guid userId,
            HttpContext context,
            [FromServices] IUserRepository userRepository,
            [FromServices] IFileStorageService fileStorageService,
            [FromServices] IOptions<R2Settings> r2Options,
            CancellationToken cancellationToken) =>
        {
            var targetUser = await userRepository.GetByIdAsync(userId, cancellationToken);
            if (targetUser == null)
            {
                return Results.NotFound(new
                {
                    success = false,
                    message = "Không tìm thấy ảnh đại diện của người dùng."
                });
            }

            var objectKey = targetUser.AvatarObjectKey;
            if (string.IsNullOrWhiteSpace(objectKey) && targetUser.AvatarUrl?.StartsWith($"avatars/{userId:D}/", StringComparison.OrdinalIgnoreCase) == true)
                objectKey = targetUser.AvatarUrl;

            if (string.IsNullOrWhiteSpace(objectKey))
            {
                if (targetUser.AvatarUrl?.StartsWith("https://", StringComparison.OrdinalIgnoreCase) == true ||
                    targetUser.AvatarUrl?.StartsWith("http://", StringComparison.OrdinalIgnoreCase) == true)
                    return Results.Redirect(targetUser.AvatarUrl);
                return Results.NotFound(new { success = false, message = "Không tìm thấy ảnh đại diện của người dùng." });
            }

            if (!objectKey.StartsWith($"avatars/{userId:D}/", StringComparison.OrdinalIgnoreCase))
                return Results.NotFound(new { success = false, message = "Ảnh đại diện không hợp lệ." });

            try
            {
                var settings = r2Options.Value;
                var destination = !string.IsNullOrWhiteSpace(settings.PublicBaseUrl)
                    ? $"{settings.PublicBaseUrl.TrimEnd('/')}/{objectKey}"
                    : await fileStorageService.GetPresignedDownloadUrlAsync(objectKey,
                        TimeSpan.FromMinutes(settings.AvatarPresignedUrlExpiryMinutes), cancellationToken);

                context.Response.Headers.CacheControl = "public, max-age=300";
                return Results.Redirect(destination);
            }
            catch
            {
                return Results.NotFound(new
                {
                    success = false,
                    message = "Không thể tạo đường dẫn tải ảnh đại diện."
                });
            }
        })
        .WithName("GetUserAvatar")
        .WithSummary("Lấy đường dẫn ảnh đại diện của người dùng theo UserId")
        .WithDescription("Chuyển hướng (302 Redirect) đến URL ảnh đại diện của người dùng.")
        .Produces(StatusCodes.Status302Found)
        .Produces(StatusCodes.Status404NotFound);

        // 3. DELETE /api/v1/users/me/avatar - Xóa ảnh đại diện hiện tại
        group.MapDelete("/me/avatar", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var result = await sender.Send(new DeleteAvatarCommand { UserId = userId.Value }, cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .RequireAuthorization()
        .WithName("DeleteUserAvatar")
        .WithSummary("Xóa ảnh đại diện của người dùng hiện tại")
        .WithDescription("Xóa ảnh đại diện trên Cloudflare R2 và xóa avatar_url trong tài khoản người dùng.")
        .Produces<DeleteAvatarResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        return app;
    }

    private static async Task<IResult> HandleAvatarUploadAsync(
        ClaimsPrincipal user,
        IFormFile? file,
        ISender sender,
        IValidator<UploadAvatarCommand> validator,
        CancellationToken cancellationToken)
    {
        var userId = GetUserIdFromClaims(user);
        if (userId is null) return Results.Unauthorized();
        if (file is null || file.Length == 0)
            return Results.BadRequest(new { success = false, message = "Vui lòng đính kèm ảnh JPEG, PNG hoặc WebP." });

        await using var stream = file.OpenReadStream();
        var command = new UploadAvatarCommand
        {
            UserId = userId.Value,
            FileStream = stream,
            FileName = file.FileName,
            ContentType = file.ContentType,
            FileSizeBytes = file.Length
        };
        var validation = await validator.ValidateAsync(command, cancellationToken);
        if (!validation.IsValid)
        {
            var status = validation.Errors.Any(error => error.PropertyName == nameof(UploadAvatarCommand.FileSizeBytes))
                ? StatusCodes.Status413PayloadTooLarge
                : validation.Errors.Any(error => error.PropertyName is nameof(UploadAvatarCommand.FileName) or nameof(UploadAvatarCommand.ContentType))
                    ? StatusCodes.Status415UnsupportedMediaType
                    : StatusCodes.Status400BadRequest;
            return Results.Json(new
            {
                success = false,
                message = "Tập tin ảnh đại diện không hợp lệ.",
                errors = validation.Errors.GroupBy(error => error.PropertyName)
                    .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage).ToArray())
            }, statusCode: status);
        }

        try
        {
            return Results.Ok(await sender.Send(command, cancellationToken));
        }
        catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
        catch (ForbiddenException ex) { return Results.Json(new { success = false, message = ex.Message }, statusCode: 403); }
        catch (BadRequestException ex) when (ex.ErrorCode == "AVATAR_UNSUPPORTED_MEDIA_TYPE")
        { return Results.Json(new { success = false, message = ex.Message }, statusCode: 415); }
        catch (BadRequestException ex)
        { return Results.Json(new { success = false, message = ex.Message }, statusCode: 422); }
        catch (InvalidOperationException ex)
        { return Results.Json(new { success = false, message = ex.Message }, statusCode: 503); }
    }

    private static Guid? GetUserIdFromClaims(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? user.FindFirst("sub")?.Value;

        if (Guid.TryParse(idClaim, out var userId))
        {
            return userId;
        }

        return null;
    }
}
