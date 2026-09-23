using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateBankAccount;
using HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateProfile;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateBankAccount;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliatePerformance;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateProfile;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Affiliates;

public static class AffiliateEndpoints
{
    public static IEndpointRouteBuilder MapAffiliateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/affiliates/profile")
                       .WithTags("Affiliate Profile")
                       .RequireAuthorization();

        // 1. GET /api/v1/affiliates/profile/me - Xem hồ sơ đối tác tuyển dụng
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
                var result = await sender.Send(new GetAffiliateProfileQuery(userId.Value), cancellationToken);
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
        .WithName("GetAffiliateProfile")
        .WithSummary("Xem thông tin hồ sơ đối tác tuyển dụng hiện tại")
        .WithDescription("Lấy toàn bộ thông tin chi tiết hồ sơ đối tác tuyển dụng (Affiliate Recruiter) của người dùng đang đăng nhập dựa trên JWT Bearer Token.")
        .Produces<AffiliateProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 2. PUT /api/v1/affiliates/profile/me - Cập nhật hồ sơ đối tác tuyển dụng
        group.MapPut("/me", async (
            ClaimsPrincipal user,
            [FromBody] UpdateAffiliateProfileCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateAffiliateProfileCommand> validator,
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
        .WithName("UpdateAffiliateProfile")
        .WithSummary("Cập nhật thông tin hồ sơ đối tác tuyển dụng")
        .WithDescription("Cập nhật thông tin hồ sơ cá nhân hoặc doanh nghiệp của đối tác tuyển dụng (tên hiển thị, người liên hệ, số điện thoại, địa chỉ, mã số thuế). Tự động đồng bộ tên và số điện thoại sang tài khoản người dùng.")
        .Produces<UpdateAffiliateProfileResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 3. GET /api/v1/affiliates/profile/me/performance - Xem thống kê hiệu suất tuyển dụng
        group.MapGet("/me/performance", async (
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
                var result = await sender.Send(new GetAffiliatePerformanceQuery(userId.Value), cancellationToken);
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
        .WithName("GetAffiliatePerformance")
        .WithSummary("Xem thống kê hiệu suất tuyển dụng của đối tác")
        .WithDescription("Lấy các chỉ số thống kê hiệu suất tuyển dụng mới nhất của đối tác tuyển dụng (tổng hồ sơ đã nộp, shortlist, phỏng vấn, tuyển dụng thành công, tỷ lệ tuyển dụng, xếp hạng chất lượng).")
        .Produces<AffiliatePerformanceResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 4. GET /api/v1/affiliates/profile/me/bank-account - Xem thông tin tài khoản ngân hàng nhận hoa hồng
        group.MapGet("/me/bank-account", async (
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
                var result = await sender.Send(new GetAffiliateBankAccountQuery(userId.Value), cancellationToken);
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
        .WithName("GetAffiliateBankAccount")
        .WithSummary("Xem thông tin tài khoản ngân hàng nhận hoa hồng")
        .WithDescription("Lấy thông tin tài khoản ngân hàng thụ hưởng nhận tiền hoa hồng của đối tác tuyển dụng (tên ngân hàng, số tài khoản, tên chủ tài khoản, chi nhánh, trạng thái cấu hình).")
        .Produces<AffiliateBankAccountResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // 5. PUT /api/v1/affiliates/profile/me/bank-account - Cập nhật thông tin tài khoản ngân hàng nhận hoa hồng
        group.MapPut("/me/bank-account", async (
            ClaimsPrincipal user,
            [FromBody] UpdateAffiliateBankAccountCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateAffiliateBankAccountCommand> validator,
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
                    message = "Dữ liệu tài khoản ngân hàng không hợp lệ.",
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
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, statusCode: 500);
            }
        })
        .WithName("UpdateAffiliateBankAccount")
        .WithSummary("Cập nhật thông tin tài khoản ngân hàng nhận hoa hồng")
        .WithDescription("Cập nhật hoặc thiết lập mới thông tin tài khoản ngân hàng thụ hưởng (ngân hàng, số tài khoản, tên chủ tài khoản, chi nhánh) để nhận tiền giải ngân hoa hồng từ Admin.")
        .Produces<UpdateAffiliateBankAccountResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status500InternalServerError);

        // ==============================================================================
        // Affiliate Submissions Endpoints
        // ==============================================================================
        var submissionsGroup = app.MapGroup("/api/v1/affiliates/submissions")
                                  .WithTags("Affiliate Submissions")
                                  .RequireAuthorization();

        // GET /api/v1/affiliates/submissions - Lấy lịch sử nộp ứng viên của Affiliate
        submissionsGroup.MapGet("/", async (
            ClaimsPrincipal user,
            [FromQuery] string? status,
            [FromQuery] Guid? jobId,
            [FromQuery] Guid? candidateId,
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

            try
            {
                var query = new HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissions.GetAffiliateSubmissionsQuery(
                    userId.Value,
                    status,
                    jobId,
                    candidateId,
                    fromDate,
                    toDate,
                    page ?? 1,
                    pageSize ?? 20);

                var result = await sender.Send(query, cancellationToken);
                return Results.Ok(result);
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(new { success = false, message = ex.Message }, statusCode: StatusCodes.Status403Forbidden);
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
        .WithName("GetAffiliateSubmissions")
        .WithSummary("Lấy lịch sử nộp ứng viên của Affiliate")
        .WithDescription("Lấy danh sách toàn bộ lịch sử các lần nộp ứng viên của Affiliate Recruiter đang đăng nhập, bao gồm cả trạng thái ACCEPTED và BLOCKED_DUPLICATE kèm lý do trùng lặp.")
        .Produces<HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissions.AffiliateSubmissionsResponse>(StatusCodes.Status200OK)
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
