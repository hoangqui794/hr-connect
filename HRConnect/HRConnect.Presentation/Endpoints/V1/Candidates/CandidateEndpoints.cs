using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateProfile;
using HRConnect.Application.Features.Candidates.Commands.UpdateProfileVisibility;
using HRConnect.Application.Features.Candidates.Commands.UploadCv;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateProfile;
using HRConnect.Application.Features.Candidates.Queries.GetCvDownloadUrl;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Candidates;

public static class CandidateEndpoints
{
    public static IEndpointRouteBuilder MapCandidateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/candidates/profile")
                       .WithTags("Candidate Profile")
                       .RequireAuthorization();

        // 1. GET /api/v1/candidates/profile/me - Xem hồ sơ ứng viên
        group.MapGet("/me", async (
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
                var result = await sender.Send(new GetCandidateProfileQuery(userId.Value), cancellationToken);
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
        .WithName("GetCandidateProfile")
        .WithSummary("Xem thông tin hồ sơ ứng viên hiện tại")
        .WithDescription("Lấy toàn bộ thông tin chi tiết hồ sơ của ứng viên đang đăng nhập dựa trên JWT Bearer Token (bao gồm kỹ năng, học vấn, kinh nghiệm, thông tin liên hệ và CV chính).")
        .Produces<CandidateProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 2. PUT /api/v1/candidates/profile/me - Cập nhật hồ sơ ứng viên
        group.MapPut("/me", async (
            ClaimsPrincipal user,
            [FromBody] UpdateCandidateProfileCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateCandidateProfileCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            command.UserId = userId.Value;

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu cập nhật hồ sơ không hợp lệ.",
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
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("UpdateCandidateProfile")
        .WithSummary("Cập nhật thông tin hồ sơ ứng viên")
        .WithDescription("Cập nhật thông tin cá nhân của ứng viên đang đăng nhập (họ tên, số điện thoại, ngày sinh, giới tính, địa chỉ, học vấn, số năm kinh nghiệm, tóm tắt bản thân). Tự động đồng bộ họ tên và số điện thoại sang tài khoản người dùng.")
        .Produces<UpdateCandidateProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 3. PATCH /api/v1/candidates/profile/me/visibility - Cập nhật chế độ hiển thị hồ sơ ứng viên
        group.MapPatch("/me/visibility", async (
            ClaimsPrincipal user,
            [FromBody] UpdateProfileVisibilityCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateProfileVisibilityCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            command.UserId = userId.Value;

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu chế độ hiển thị không hợp lệ.",
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
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("UpdateCandidateProfileVisibility")
        .WithSummary("Cập nhật chế độ hiển thị hồ sơ ứng viên (PUBLIC/PRIVATE)")
        .WithDescription("Chuyển đổi chế độ hiển thị hồ sơ tìm việc của ứng viên: PUBLIC (cho phép nhà tuyển dụng tìm thấy) hoặc PRIVATE (ẩn hồ sơ).")
        .Produces<UpdateProfileVisibilityResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // ==============================================================================
        // Candidate CV Storage Endpoints (Cloudflare R2 Integration)
        // ==============================================================================
        var cvGroup = app.MapGroup("/api/v1/candidates/cv")
                         .WithTags("Candidate CV")
                         .RequireAuthorization();

        // 4. POST /api/v1/candidates/cv - Tải lên hồ sơ CV PDF
        cvGroup.MapPost("", async (
            ClaimsPrincipal user,
            [FromForm] IFormFile? file,
            [FromForm] string? title,
            [FromForm] bool? isPrimary,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (file == null || file.Length == 0)
            {
                return Results.BadRequest(new { success = false, message = "Vui lòng đính kèm tệp CV định dạng PDF." });
            }

            var command = new UploadCvCommand
            {
                UserId = userId.Value,
                FileStream = file.OpenReadStream(),
                FileName = file.FileName,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length,
                Title = title,
                IsPrimary = isPrimary ?? false
            };

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
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
        .WithName("UploadCandidateCv")
        .WithSummary("Tải lên CV PDF cho ứng viên")
        .WithDescription("Tải lên tệp CV PDF của ứng viên lên hệ thống Cloudflare R2 riêng tư, tự động sinh khóa lưu trữ candidates/{candidateId}/cvs/{cvId}.pdf.")
        .DisableAntiforgery()
        .Produces<UploadCvResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 5. GET /api/v1/candidates/cv/{cvId:guid}/download-url - Lấy đường dẫn tải xuống CV tạm thời
        cvGroup.MapGet("/{cvId:guid}/download-url", async (
            ClaimsPrincipal user,
            Guid cvId,
            [FromQuery] int? expiryMinutes,
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
                var result = await sender.Send(new GetCvDownloadUrlQuery(cvId, userId, expiryMinutes), cancellationToken);
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
        .WithName("GetCandidateCvDownloadUrl")
        .WithSummary("Lấy URL tải xuống CV có chữ ký tạm thời (Presigned URL)")
        .WithDescription("Sinh đường dẫn có chữ ký số (Presigned URL) có hiệu lực ngắn (mặc định 15 phút) để tải hoặc xem tệp CV trực tiếp từ Cloudflare R2.")
        .Produces<GetCvDownloadUrlResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

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
