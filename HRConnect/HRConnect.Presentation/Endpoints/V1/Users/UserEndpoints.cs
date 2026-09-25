using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Users.Commands.UploadAvatar;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Users;

public static class UserEndpoints
{
    public static IEndpointRouteBuilder MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users")
                       .WithTags("Users");

        // 1. POST /api/v1/users/me/avatar - Tải lên ảnh đại diện của người dùng hiện tại
        group.MapPost("/me/avatar", async (
            ClaimsPrincipal user,
            IFormFile? file,
            [FromServices] ISender sender,
            [FromServices] IValidator<UploadAvatarCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (file == null || file.Length == 0)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Vui lòng đính kèm tập tin ảnh đại diện (.jpg, .jpeg, .png, .webp)."
                });
            }

            var command = new UploadAvatarCommand
            {
                UserId = userId.Value,
                FileStream = file.OpenReadStream(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length
            };

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Tập tin ảnh đại diện không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

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
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
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
        .Produces(StatusCodes.Status500InternalServerError);

        // Alias: POST /api/v1/users/avatar
        group.MapPost("/avatar", async (
            ClaimsPrincipal user,
            IFormFile? file,
            [FromServices] ISender sender,
            [FromServices] IValidator<UploadAvatarCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (file == null || file.Length == 0)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Vui lòng đính kèm tập tin ảnh đại diện (.jpg, .jpeg, .png, .webp)."
                });
            }

            var command = new UploadAvatarCommand
            {
                UserId = userId.Value,
                FileStream = file.OpenReadStream(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length
            };

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Tập tin ảnh đại diện không hợp lệ.",
                    errors = validationResult.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())
                });
            }

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
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .RequireAuthorization()
        .DisableAntiforgery()
        .WithName("UploadUserAvatarAlias")
        .WithSummary("Tải lên ảnh đại diện cho người dùng hiện tại (Alias)")
        .WithDescription("Đường dẫn thay thế cho /api/v1/users/me/avatar.")
        .Produces<UploadAvatarResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 2. GET /api/v1/users/{userId:guid}/avatar - Xem ảnh đại diện của người dùng
        group.MapGet("/{userId:guid}/avatar", async (
            Guid userId,
            [FromServices] IUserRepository userRepository,
            [FromServices] IFileStorageService fileStorageService,
            CancellationToken cancellationToken) =>
        {
            var targetUser = await userRepository.GetByIdAsync(userId, cancellationToken);
            if (targetUser == null || string.IsNullOrWhiteSpace(targetUser.AvatarUrl))
            {
                return Results.NotFound(new
                {
                    success = false,
                    message = "Không tìm thấy ảnh đại diện của người dùng."
                });
            }

            if (targetUser.AvatarUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                targetUser.AvatarUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Redirect(targetUser.AvatarUrl);
            }

            try
            {
                var presignedUrl = await fileStorageService.GetPresignedDownloadUrlAsync(
                    targetUser.AvatarUrl,
                    TimeSpan.FromHours(24),
                    cancellationToken);

                return Results.Redirect(presignedUrl);
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

        return app;
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
