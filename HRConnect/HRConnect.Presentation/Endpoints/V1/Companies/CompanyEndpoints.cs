using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Companies.Commands.DeleteCompanyLogo;
using HRConnect.Application.Features.Companies.Commands.UploadCompanyLogo;
using HRConnect.Application.Features.Companies.Commands.UpdateCompanyProfile;
using HRConnect.Application.Features.Companies.Queries.GetCompanyProfile;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace HRConnect.Presentation.Endpoints.V1.Companies;

public static class CompanyEndpoints
{
    public static IEndpointRouteBuilder MapCompanyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/companies/profile")
                       .WithTags("Company Profile")
                       .RequireAuthorization();

        // 1. GET /api/v1/companies/profile/me - Xem hồ sơ công ty hiện tại
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
                var result = await sender.Send(new GetCompanyProfileQuery(userId.Value), cancellationToken);
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
        .WithName("GetCompanyProfile")
        .WithSummary("Xem thông tin hồ sơ doanh nghiệp hiện tại")
        .WithDescription("Lấy toàn bộ thông tin chi tiết hồ sơ công ty mà người dùng hiện tại đang trực thuộc (Client Company User) dựa trên JWT Bearer Token.")
        .Produces<CompanyProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 2. PUT /api/v1/companies/profile/me - Cập nhật hồ sơ công ty hiện tại
        group.MapPut("/me", async (
            ClaimsPrincipal user,
            [FromBody] UpdateCompanyProfileCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateCompanyProfileCommand> validator,
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
                    message = "Dữ liệu cập nhật hồ sơ công ty không hợp lệ.",
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
        .WithName("UpdateCompanyProfile")
        .WithSummary("Cập nhật thông tin hồ sơ doanh nghiệp hiện tại")
        .WithDescription("Cập nhật các thông tin công ty như tên công ty, mã số thuế, ngành nghề, quy mô, website, địa chỉ và mô tả dựa trên tài khoản đang đăng nhập.")
        .Produces<UpdateCompanyProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        group.MapPost("/me/logo", HandleLogoUploadAsync)
            .DisableAntiforgery()
            .WithName("UploadCompanyLogo")
            .WithSummary("Tải lên logo của doanh nghiệp hiện tại")
            .WithDescription("Chuẩn hóa ảnh JPG, PNG hoặc WebP sang WebP, lưu trên object storage và thay thế logo cũ an toàn.")
            .Produces<CompanyLogoResponse>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status503ServiceUnavailable);

        group.MapDelete("/me/logo", async (ClaimsPrincipal user, ISender sender, CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId is null) return Results.Unauthorized();
            try
            {
                return Results.Ok(await sender.Send(new DeleteCompanyLogoCommand { UserId = userId.Value }, cancellationToken));
            }
            catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
            catch (ForbiddenException ex) { return Results.Json(new { success = false, message = ex.Message }, statusCode: 403); }
        })
        .WithName("DeleteCompanyLogo")
        .WithSummary("Xóa logo của doanh nghiệp hiện tại")
        .Produces<CompanyLogoResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        app.MapGet("/api/v1/companies/{companyId:guid}/logo", async (
            Guid companyId,
            HttpContext context,
            ICompanyRepository companies,
            IFileStorageService storage,
            IOptions<R2Settings> options,
            CancellationToken cancellationToken) =>
        {
            var company = await companies.GetByIdAsync(companyId, cancellationToken);
            if (company is null)
                return Results.NotFound(new { success = false, message = "Không tìm thấy logo doanh nghiệp." });

            var prefix = $"company-logos/{companyId:D}/";
            var objectKey = company.LogoObjectKey;
            if (string.IsNullOrWhiteSpace(objectKey) && company.LogoUrl?.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) == true)
                objectKey = company.LogoUrl;
            if (string.IsNullOrWhiteSpace(objectKey))
            {
                if (Uri.TryCreate(company.LogoUrl, UriKind.Absolute, out var external) &&
                    (external.Scheme == Uri.UriSchemeHttps || external.Scheme == Uri.UriSchemeHttp))
                    return Results.Redirect(external.ToString());
                return Results.NotFound(new { success = false, message = "Không tìm thấy logo doanh nghiệp." });
            }
            if (!objectKey.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) || objectKey.Contains("..", StringComparison.Ordinal))
                return Results.NotFound(new { success = false, message = "Logo doanh nghiệp không hợp lệ." });

            try
            {
                var settings = options.Value;
                var destination = !string.IsNullOrWhiteSpace(settings.PublicBaseUrl)
                    ? $"{settings.PublicBaseUrl.TrimEnd('/')}/{objectKey}"
                    : await storage.GetPresignedDownloadUrlAsync(objectKey,
                        TimeSpan.FromMinutes(settings.AvatarPresignedUrlExpiryMinutes), cancellationToken);
                context.Response.Headers.CacheControl = "public, max-age=300";
                return Results.Redirect(destination);
            }
            catch
            {
                return Results.NotFound(new { success = false, message = "Không thể tạo đường dẫn logo doanh nghiệp." });
            }
        })
        .WithTags("Company Profile")
        .WithName("GetCompanyLogo")
        .WithSummary("Lấy logo công khai của doanh nghiệp")
        .Produces(StatusCodes.Status302Found)
        .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> HandleLogoUploadAsync(
        ClaimsPrincipal user,
        IFormFile? file,
        ISender sender,
        IValidator<UploadCompanyLogoCommand> validator,
        CancellationToken cancellationToken)
    {
        var userId = GetUserIdFromClaims(user);
        if (userId is null) return Results.Unauthorized();
        if (file is null || file.Length == 0)
            return Results.BadRequest(new { success = false, message = "Vui lòng chọn ảnh logo JPG, PNG hoặc WebP." });

        await using var stream = file.OpenReadStream();
        var command = new UploadCompanyLogoCommand
        {
            UserId = userId.Value,
            FileStream = stream,
            FileName = file.FileName,
            ContentType = file.ContentType,
            FileSizeBytes = file.Length
        };
        var validation = await validator.ValidateAsync(command, cancellationToken);
        if (!validation.IsValid)
            return Results.BadRequest(new
            {
                success = false,
                message = "Logo doanh nghiệp không hợp lệ.",
                errors = validation.Errors.GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())
            });

        try { return Results.Ok(await sender.Send(command, cancellationToken)); }
        catch (NotFoundException ex) { return Results.NotFound(new { success = false, message = ex.Message }); }
        catch (ForbiddenException ex) { return Results.Json(new { success = false, message = ex.Message }, statusCode: 403); }
        catch (BadRequestException ex) { return Results.BadRequest(new { success = false, message = ex.Message, code = ex.ErrorCode }); }
        catch (InvalidOperationException ex) { return Results.Json(new { success = false, message = ex.Message }, statusCode: 503); }
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
