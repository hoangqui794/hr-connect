using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Admin.Approvals.ApproveAffiliate;
using HRConnect.Application.Features.Admin.Approvals.ApproveCompany;
using HRConnect.Application.Features.Admin.Approvals.GetAffiliateApplicationDetail;
using HRConnect.Application.Features.Admin.Approvals.GetApprovalList;
using HRConnect.Application.Features.Admin.Approvals.GetCompanyVerificationDetail;
using HRConnect.Application.Features.Admin.Approvals.RejectAffiliate;
using HRConnect.Application.Features.Admin.Approvals.RejectCompany;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Admin;

public static class AdminApprovalEndpoints
{
    public static IEndpointRouteBuilder MapAdminApprovalEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin")
                       .WithTags("Admin Approvals")
                       .RequireAuthorization();

        // 1. Danh sách phê duyệt hợp nhất (Unified Approval List)
        group.MapGet("/approvals", async (
            [FromQuery] string? type,
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string sortBy = "submittedAt",
            [FromQuery] string sortDirection = "desc",
            [FromServices] ISender sender = null!,
            ClaimsPrincipal user = null!,
            CancellationToken cancellationToken = default) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền truy cập danh sách phê duyệt."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var query = new GetApprovalListQuery(type, status, search, page, pageSize, sortBy, sortDirection);
            var result = await sender.Send(query, cancellationToken);
            return Results.Ok(result);
        })
        .WithName("GetApprovalList")
        .WithSummary("Lấy danh sách yêu cầu phê duyệt hợp nhất (Affiliate & Client)")
        .WithDescription("Hỗ trợ lọc theo type (AFFILIATE, CLIENT), status (PENDING, APPROVED, REJECTED), search không phân biệt hoa thường, phân trang và sắp xếp.")
        .Produces<GetApprovalListResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        // 2. Chi tiết đơn đăng ký Affiliate
        group.MapGet("/affiliate-applications/{id:guid}", async (
            Guid id,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!HasAffiliateVerifyPermission(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền xem chi tiết đơn đăng ký Affiliate (yêu cầu quyền affiliate.verify)."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            try
            {
                var result = await sender.Send(new GetAffiliateApplicationDetailQuery(id), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        })
        .WithName("GetAffiliateApplicationDetail")
        .WithSummary("Xem chi tiết đơn đăng ký Affiliate")
        .Produces<GetAffiliateApplicationDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // 3. Phê duyệt đơn đăng ký Affiliate
        group.MapPost("/affiliate-applications/{id:guid}/approve", async (
            Guid id,
            [FromBody] ApproveAffiliateRequest? body,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!HasAffiliateVerifyPermission(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền phê duyệt đơn đăng ký Affiliate (yêu cầu quyền affiliate.verify)."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var adminUserId = GetCurrentUserId(user);
            if (!adminUserId.HasValue)
            {
                return Results.Unauthorized();
            }

            try
            {
                var command = new ApproveAffiliateCommand(id, body?.Note, adminUserId.Value);
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
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
        .WithName("ApproveAffiliate")
        .WithSummary("Phê duyệt đơn đăng ký Affiliate Recruiter")
        .Produces<ApproveAffiliateResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // 4. Từ chối đơn đăng ký Affiliate
        group.MapPost("/affiliate-applications/{id:guid}/reject", async (
            Guid id,
            [FromBody] RejectAffiliateRequest body,
            [FromServices] ISender sender,
            [FromServices] IValidator<RejectAffiliateCommand> validator,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!HasAffiliateVerifyPermission(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền từ chối đơn đăng ký Affiliate (yêu cầu quyền affiliate.verify)."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var adminUserId = GetCurrentUserId(user);
            if (!adminUserId.HasValue)
            {
                return Results.Unauthorized();
            }

            var command = new RejectAffiliateCommand(id, body?.Reason ?? string.Empty, adminUserId.Value);
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu không hợp lệ.",
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("RejectAffiliate")
        .WithSummary("Từ chối đơn đăng ký Affiliate Recruiter")
        .Produces<RejectAffiliateResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // 5. Chi tiết yêu cầu xác thực Doanh nghiệp
        group.MapGet("/company-verification-requests/{id:guid}", async (
            Guid id,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!HasCompanyVerifyPermission(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền xem chi tiết yêu cầu xác thực Doanh nghiệp (yêu cầu quyền company.verify)."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            try
            {
                var result = await sender.Send(new GetCompanyVerificationDetailQuery(id), cancellationToken);
                return Results.Ok(result);
            }
            catch (NotFoundException ex)
            {
                return Results.NotFound(new
                {
                    success = false,
                    message = ex.Message
                });
            }
        })
        .WithName("GetCompanyVerificationDetail")
        .WithSummary("Xem chi tiết yêu cầu xác thực Doanh nghiệp")
        .Produces<GetCompanyVerificationDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        // 6. Phê duyệt yêu cầu xác thực Doanh nghiệp
        group.MapPost("/company-verification-requests/{id:guid}/approve", async (
            Guid id,
            [FromBody] ApproveCompanyRequest? body,
            [FromServices] ISender sender,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!HasCompanyVerifyPermission(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền phê duyệt yêu cầu xác thực Doanh nghiệp (yêu cầu quyền company.verify)."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var adminUserId = GetCurrentUserId(user);
            if (!adminUserId.HasValue)
            {
                return Results.Unauthorized();
            }

            try
            {
                var command = new ApproveCompanyCommand(id, body?.Note, adminUserId.Value);
                var result = await sender.Send(command, cancellationToken);
                return Results.Ok(result);
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
        .WithName("ApproveCompany")
        .WithSummary("Phê duyệt yêu cầu xác thực Doanh nghiệp (Client Company)")
        .Produces<ApproveCompanyResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        // 7. Từ chối yêu cầu xác thực Doanh nghiệp
        group.MapPost("/company-verification-requests/{id:guid}/reject", async (
            Guid id,
            [FromBody] RejectCompanyRequest body,
            [FromServices] ISender sender,
            [FromServices] IValidator<RejectCompanyCommand> validator,
            ClaimsPrincipal user,
            CancellationToken cancellationToken) =>
        {
            if (!HasCompanyVerifyPermission(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền từ chối yêu cầu xác thực Doanh nghiệp (yêu cầu quyền company.verify)."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var adminUserId = GetCurrentUserId(user);
            if (!adminUserId.HasValue)
            {
                return Results.Unauthorized();
            }

            var command = new RejectCompanyCommand(id, body?.Reason ?? string.Empty, adminUserId.Value);
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu không hợp lệ.",
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
            catch (ConflictException ex)
            {
                return Results.Conflict(new { success = false, message = ex.Message });
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("RejectCompany")
        .WithSummary("Từ chối yêu cầu xác thực Doanh nghiệp (Client Company)")
        .Produces<RejectCompanyResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        return app;
    }

    private static bool HasAdminAccess(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "affiliate.verify") ||
        user.HasClaim("permission", "company.verify");

    private static bool HasAffiliateVerifyPermission(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "affiliate.verify");

    private static bool HasCompanyVerifyPermission(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "company.verify");

    private static Guid? GetCurrentUserId(ClaimsPrincipal user)
    {
        var idString = user.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                    ?? user.FindFirst("sub")?.Value;

        return Guid.TryParse(idString, out var guid) ? guid : null;
    }
}

public record ApproveAffiliateRequest(string? Note);
public record RejectAffiliateRequest(string Reason);
public record ApproveCompanyRequest(string? Note);
public record RejectCompanyRequest(string Reason);
