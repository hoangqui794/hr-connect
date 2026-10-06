using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Candidates.Commands.DeleteCandidateCv;
using HRConnect.Application.Features.Candidates.Commands.SetCandidatePrimaryCv;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateCv;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateProfile;
using HRConnect.Application.Features.Candidates.Commands.UpdateProfileVisibility;
using HRConnect.Application.Features.Candidates.Commands.UploadCv;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvs;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDetail;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvUsages;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateAffiliateCvDownloadUrl;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateAffiliateCvReuse;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateProfile;
using HRConnect.Application.Features.Candidates.Queries.GetCvDownloadUrl;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using HRConnect.Presentation.Authorization;

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

        var affiliateCvGroup = app.MapGroup("/api/v1/candidates/me/affiliate-cvs")
            .WithTags("Candidate Affiliate CVs")
            .RequireAuthorization();

        affiliateCvGroup.MapGet("", async (
            ClaimsPrincipal user,
            int page,
            int pageSize,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, "cv.view_own"))
                return PermissionAuthorization.Forbidden("cv.view_own");
            var userId = GetUserIdFromClaims(user);
            if (!userId.HasValue) return Results.Unauthorized();

            try
            {
                return Results.Ok(await sender.Send(
                    new GetCandidateAffiliateCvsQuery(userId.Value, page, pageSize), cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetCandidateAffiliateCvs")
        .WithSummary("Candidate xem danh sách CV do Affiliate đã nộp thay")
        .WithDescription("Yêu cầu permission cv.view_own. Trả riêng tài liệu do Affiliate tải lên, trạng thái consent tổng hợp và trạng thái cho phép tái sử dụng; không trộn vào kho CV cá nhân.")
        .Produces<GetCandidateAffiliateCvsResponse>()
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        affiliateCvGroup.MapPatch("/{cvId:guid}/reuse", async (
            Guid cvId,
            [FromBody] UpdateCandidateAffiliateCvReuseRequest request,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, "cv.affiliate_reuse.manage_own"))
                return PermissionAuthorization.Forbidden("cv.affiliate_reuse.manage_own");
            var userId = GetUserIdFromClaims(user);
            if (!userId.HasValue) return Results.Unauthorized();

            try
            {
                return Results.Ok(await sender.Send(
                    new UpdateCandidateAffiliateCvReuseCommand(
                        userId.Value,
                        cvId,
                        request.Allowed,
                        request.ConcurrencyToken),
                    cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new
                {
                    success = false,
                    message = ex.Message,
                    errorCode = ex.ErrorCode
                });
            }
        })
        .WithName("UpdateCandidateAffiliateCvReuse")
        .WithSummary("Candidate bật hoặc thu hồi quyền Affiliate tái sử dụng CV")
        .WithDescription("Yêu cầu permission cv.affiliate_reuse.manage_own. concurrencyToken phải lấy từ API danh sách/chi tiết. Thu hồi chỉ chặn lần nộp mới; lịch sử Submission/Application cũ được giữ nguyên.")
        .Produces<UpdateCandidateAffiliateCvReuseResponse>()
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        affiliateCvGroup.MapGet("/{cvId:guid}/download-url", async (
            Guid cvId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, "cv.view_own"))
                return PermissionAuthorization.Forbidden("cv.view_own");
            var userId = GetUserIdFromClaims(user);
            if (!userId.HasValue) return Results.Unauthorized();

            try
            {
                return Results.Ok(await sender.Send(
                    new GetCandidateAffiliateCvDownloadUrlQuery(userId.Value, cvId), cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetCandidateAffiliateCvDownloadUrl")
        .WithSummary("Candidate lấy đường dẫn tạm thời để xem CV do Affiliate tải lên")
        .WithDescription("Yêu cầu permission cv.view_own. Chỉ ký URL cho CV thuộc đúng Candidate đang đăng nhập; URL hết hạn sau 5 phút và lượt truy cập được ghi audit.")
        .Produces<GetCandidateAffiliateCvDownloadUrlResponse>()
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        affiliateCvGroup.MapGet("/{cvId:guid}/usages", async (
            Guid cvId,
            ClaimsPrincipal user,
            int page,
            int pageSize,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, "cv.view_own"))
                return PermissionAuthorization.Forbidden("cv.view_own");
            var userId = GetUserIdFromClaims(user);
            if (!userId.HasValue) return Results.Unauthorized();

            try
            {
                return Results.Ok(await sender.Send(
                    new GetCandidateAffiliateCvUsagesQuery(userId.Value, cvId, page, pageSize), cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetCandidateAffiliateCvUsages")
        .WithSummary("Candidate xem các Job đã sử dụng CV do Affiliate tải lên")
        .WithDescription("Yêu cầu permission cv.view_own. Trả lịch sử nộp theo thời gian mới nhất, gồm Affiliate, Job, doanh nghiệp, consent, Application và kết quả AI mới nhất nếu đã có.")
        .Produces<GetCandidateAffiliateCvUsagesResponse>()
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        affiliateCvGroup.MapGet("/{cvId:guid}", async (
            Guid cvId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, "cv.view_own"))
                return PermissionAuthorization.Forbidden("cv.view_own");
            var userId = GetUserIdFromClaims(user);
            if (!userId.HasValue) return Results.Unauthorized();

            try
            {
                return Results.Ok(await sender.Send(
                    new GetCandidateAffiliateCvDetailQuery(userId.Value, cvId), cancellationToken));
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new { success = false, message = ex.Message });
            }
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
        })
        .WithName("GetCandidateAffiliateCvDetail")
        .WithSummary("Candidate xem chi tiết CV do Affiliate đã nộp thay")
        .WithDescription("Yêu cầu permission cv.view_own. Chỉ trả CV thuộc đúng Candidate đang đăng nhập và có lịch sử Affiliate nộp; không trả URL tải tệp tại API metadata này.")
        .Produces<GetCandidateAffiliateCvDetailResponse>()
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // 4. POST /api/v1/candidates/cv - Tải lên hồ sơ CV PDF
        cvGroup.MapPost("", async (
            ClaimsPrincipal user,
            IFormFile? file,
            [FromForm] string? title,
            [FromForm] bool? isPrimary,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, "cv.create"))
                return PermissionAuthorization.Forbidden("cv.create");

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
        .WithSummary("Tải lên CV mới vào kho CV của ứng viên")
        .WithDescription("Yêu cầu permission cv.create. Tải lên tệp CV PDF của ứng viên lên hệ thống Cloudflare R2 riêng tư, tự động sinh khóa lưu trữ candidates/{candidateId}/cvs/{cvId}.pdf.")
        .DisableAntiforgery()
        .Produces<UploadCvResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 4.1 GET /api/v1/candidates/cv - Lấy danh sách CV của ứng viên hiện tại
        cvGroup.MapGet("", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!PermissionAuthorization.HasPermission(user, "cv.view_own"))
                return PermissionAuthorization.Forbidden("cv.view_own");

            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var result = await sender.Send(new GetCandidateCvsQuery(userId.Value), cancellationToken);
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
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("GetCandidateCvs")
        .WithSummary("Lấy danh sách CV của ứng viên hiện tại")
        .WithDescription("Yêu cầu permission cv.view_own. Ứng viên có thể lưu nhiều CV trong kho CV cá nhân. Một CV có thể được sử dụng cho nhiều hồ sơ ứng tuyển khác nhau. Danh sách sắp xếp ưu tiên CV chính lên đầu.")
        .Produces<GetCandidateCvsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
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

            if (!PermissionAuthorization.HasPermission(user, "cv.view_own"))
            {
                return PermissionAuthorization.Forbidden("cv.view_own");
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
        .WithSummary("Lấy URL tạm thời để xem hoặc tải CV của ứng viên")
        .WithDescription("Yêu cầu permission cv.view_own. Sinh đường dẫn có chữ ký số (Presigned URL) có hiệu lực ngắn (mặc định 15 phút) để tải hoặc xem tệp CV trực tiếp từ Cloudflare R2.")
        .Produces<GetCvDownloadUrlResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // 6. PATCH /api/v1/candidates/cv/{cvId:guid} - Cập nhật thông tin CV của ứng viên
        cvGroup.MapPatch("/{cvId:guid}", async (
            ClaimsPrincipal user,
            Guid cvId,
            [FromBody] UpdateCandidateCvRequest request,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateCandidateCvCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, "cv.update_own"))
            {
                return PermissionAuthorization.Forbidden("cv.update_own");
            }

            var command = new UpdateCandidateCvCommand
            {
                CvId = cvId,
                UserId = userId.Value,
                Title = request?.Title ?? string.Empty
            };

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu cập nhật CV không hợp lệ.",
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message, errorCode = ex.ErrorCode });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("UpdateCandidateCvMetadata")
        .WithSummary("Cập nhật thông tin CV của ứng viên")
        .WithDescription("Yêu cầu permission cv.update_own. Chỉ cập nhật metadata CV thuộc kho cá nhân; CV do Affiliate tải lên phải được quản lý qua nhóm Candidate Affiliate CVs.")
        .Produces<UpdateCandidateCvResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status500InternalServerError);

        // 7. PATCH /api/v1/candidates/cv/{cvId:guid}/primary - Đặt CV làm CV chính của ứng viên
        cvGroup.MapPatch("/{cvId:guid}/primary", async (
            ClaimsPrincipal user,
            Guid cvId,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, "cv.update_own"))
            {
                return PermissionAuthorization.Forbidden("cv.update_own");
            }

            var command = new SetCandidatePrimaryCvCommand
            {
                CvId = cvId,
                UserId = userId.Value
            };

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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message, errorCode = ex.ErrorCode });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("SetCandidatePrimaryCv")
        .WithSummary("Đặt CV làm CV chính của ứng viên")
        .WithDescription("Yêu cầu permission cv.update_own. Chỉ CV thuộc kho cá nhân mới được đặt làm CV chính; CV do Affiliate tải lên được quản lý riêng. Thao tác không thay đổi CV đã dùng trong các Application trước đó.")
        .Produces<SetCandidatePrimaryCvResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status500InternalServerError);

        // 8. DELETE /api/v1/candidates/cv/{cvId:guid} - Xóa hoặc gỡ CV khỏi kho CV của ứng viên
        cvGroup.MapDelete("/{cvId:guid}", async (
            ClaimsPrincipal user,
            Guid cvId,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, "cv.delete_own"))
            {
                return PermissionAuthorization.Forbidden("cv.delete_own");
            }

            var command = new DeleteCandidateCvCommand(cvId, userId.Value);

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
        .WithName("DeleteCandidateCv")
        .WithSummary("Xóa hoặc gỡ CV khỏi kho CV của ứng viên")
        .WithDescription("Yêu cầu permission cv.delete_own. CV đã được Application sử dụng không bị hard delete và tệp PDF vẫn được giữ để bảo toàn lịch sử. CV chưa sử dụng được xóa khỏi DB trước, sau đó hệ thống dọn tệp PDF an toàn.")
        .Produces<DeleteCandidateCvResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // ==============================================================================
        // Candidate Applications History Endpoints
        // ==============================================================================
        var appGroup = app.MapGroup("/api/v1/candidates/applications")
                          .WithTags("Candidate Applications")
                          .RequireAuthorization();

        // GET /api/v1/candidates/applications - Lấy lịch sử ứng tuyển của ứng viên hiện tại
        appGroup.MapGet("/", async (
            ClaimsPrincipal user,
            [FromQuery] string? status,
            [FromQuery] Guid? jobId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, "application.view_own"))
            {
                return PermissionAuthorization.Forbidden("application.view_own");
            }

            try
            {
                var query = new HRConnect.Application.Features.Candidates.Queries.GetCandidateApplications.GetCandidateApplicationsQuery(
                    userId.Value,
                    status,
                    jobId,
                    fromDate,
                    toDate,
                    page ?? 1,
                    pageSize ?? 20);

                var result = await sender.Send(query, cancellationToken);
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
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("GetCandidateApplications")
        .WithSummary("Lấy lịch sử ứng tuyển của ứng viên hiện tại")
        .WithDescription("Yêu cầu permission application.view_own. Lấy danh sách lịch sử các công việc đã ứng tuyển của ứng viên đang đăng nhập, kèm thông tin công việc, CV và trạng thái.")
        .Produces<HRConnect.Application.Features.Candidates.Queries.GetCandidateApplications.CandidateApplicationsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // GET /api/v1/candidates/applications/{applicationId} - Lấy chi tiết hồ sơ ứng tuyển của ứng viên hiện tại
        appGroup.MapGet("/{applicationId:guid}", async (
            Guid applicationId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!PermissionAuthorization.HasPermission(user, "application.view_own"))
            {
                return PermissionAuthorization.Forbidden("application.view_own");
            }

            try
            {
                var query = new HRConnect.Application.Features.Candidates.Queries.GetCandidateApplicationDetail.GetCandidateApplicationDetailQuery(
                    applicationId,
                    userId.Value);

                var result = await sender.Send(query, cancellationToken);
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
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("GetCandidateApplicationDetail")
        .WithSummary("Lấy chi tiết hồ sơ ứng tuyển của ứng viên hiện tại")
        .WithDescription("Yêu cầu permission application.view_own. Xem thông tin chi tiết một đơn ứng tuyển của ứng viên đang đăng nhập, bao gồm trạng thái, công việc, CV và kết quả AI nếu có.")
        .Produces<HRConnect.Application.Features.Candidates.Queries.GetCandidateApplicationDetail.CandidateApplicationDetailResponse>(StatusCodes.Status200OK)
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
