using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.CommissionRules.Commands.ActivateCommissionRule;
using HRConnect.Application.Features.CommissionRules.Commands.CreateCommissionRule;
using HRConnect.Application.Features.CommissionRules.Commands.DeactivateCommissionRule;
using HRConnect.Application.Features.CommissionRules.Commands.UpdateCommissionRule;
using HRConnect.Application.Features.CommissionRules.Queries.GetCommissionRuleDetail;
using HRConnect.Application.Features.CommissionRules.Queries.GetCommissionRules;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.CommissionRules;

public static class CommissionRuleEndpoints
{
    public static IEndpointRouteBuilder MapCommissionRuleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/commission-rules")
            .WithTags("Admin Commission Rules")
            .RequireAuthorization();

        group.MapGet("", async (
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromQuery] Guid? serviceTypeId,
            [FromQuery] string? milestoneType,
            [FromQuery] bool? isActive,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            return Results.Ok(await sender.Send(new GetCommissionRulesQuery(
                serviceTypeId, milestoneType, isActive, page, pageSize), cancellationToken));
        })
        .WithName("GetCommissionRules")
        .WithSummary("Lấy danh sách quy tắc hoa hồng")
        .WithDescription("Admin xem và lọc quy tắc theo loại dịch vụ, mốc hoa hồng và trạng thái.")
        .Produces<GetCommissionRulesResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        group.MapGet("/{commissionRuleId:guid}", async (
            Guid commissionRuleId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken = default) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            try
            {
                return Results.Ok(await sender.Send(
                    new GetCommissionRuleDetailQuery(commissionRuleId), cancellationToken));
            }
            catch (NotFoundException exception)
            {
                return Results.NotFound(new { success = false, message = exception.Message });
            }
        })
        .WithName("GetCommissionRuleDetail")
        .WithSummary("Lấy chi tiết quy tắc hoa hồng")
        .WithDescription("Admin xem đầy đủ cấu hình của một quy tắc hoa hồng theo ID.")
        .Produces<GetCommissionRuleDetailResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        group.MapPatch("/{commissionRuleId:guid}/activate", async (
            Guid commissionRuleId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Forbidden();
            }

            try
            {
                return Results.Ok(await sender.Send(
                    new ActivateCommissionRuleCommand(commissionRuleId), cancellationToken));
            }
            catch (NotFoundException exception)
            {
                return Results.NotFound(new { success = false, message = exception.Message });
            }
            catch (ConflictException exception)
            {
                return Results.Conflict(new { success = false, message = exception.Message });
            }
        })
        .WithName("ActivateCommissionRule")
        .WithSummary("Kích hoạt lại quy tắc hoa hồng")
        .WithDescription("Admin bật lại rule đã ngừng hiệu lực. Hệ thống chặn nếu trùng rule đang hoạt động cùng loại dịch vụ, mốc và thời điểm hiệu lực.")
        .Produces<ActivateCommissionRuleResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        group.MapPut("/{commissionRuleId:guid}", async (
            Guid commissionRuleId,
            [FromBody] UpdateCommissionRuleCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<UpdateCommissionRuleCommand> validator,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Forbidden();
            }

            command.CommissionRuleId = commissionRuleId;
            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return ValidationProblem(validationResult);
            }

            try
            {
                return Results.Ok(await sender.Send(command, cancellationToken));
            }
            catch (NotFoundException exception)
            {
                return Results.NotFound(new { success = false, message = exception.Message });
            }
            catch (ConflictException exception)
            {
                return Results.Conflict(new { success = false, message = exception.Message });
            }
        })
        .WithName("UpdateCommissionRule")
        .WithSummary("Cập nhật quy tắc hoa hồng")
        .WithDescription("Admin cập nhật mức hoa hồng, bảo hành và thời gian hiệu lực. Không đổi loại dịch vụ hoặc mốc của rule.")
        .Produces<UpdateCommissionRuleResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        group.MapPatch("/{commissionRuleId:guid}/deactivate", async (
            Guid commissionRuleId,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Forbidden();
            }

            try
            {
                return Results.Ok(await sender.Send(
                    new DeactivateCommissionRuleCommand(commissionRuleId), cancellationToken));
            }
            catch (NotFoundException exception)
            {
                return Results.NotFound(new { success = false, message = exception.Message });
            }
        })
        .WithName("DeactivateCommissionRule")
        .WithSummary("Ngừng hiệu lực quy tắc hoa hồng")
        .WithDescription("Admin tắt rule an toàn, không xóa dữ liệu lịch sử hoặc commission đã phát sinh.")
        .Produces<DeactivateCommissionRuleResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        group.MapPost("", async (
            [FromBody] CreateCommissionRuleCommand command,
            ClaimsPrincipal user,
            [FromServices] ISender sender,
            [FromServices] IValidator<CreateCommissionRuleCommand> validator,
            CancellationToken cancellationToken) =>
        {
            if (!HasAdminAccess(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Du lieu yeu cau khong hop le.",
                    errors = validationResult.Errors
                        .GroupBy(error => error.PropertyName)
                        .ToDictionary(
                            group => group.Key,
                            group => group.Select(error => error.ErrorMessage).ToArray())
                });
            }

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/v1/admin/commission-rules/{result.Data.CommissionRuleId}", result);
            }
            catch (BadRequestException exception)
            {
                return Results.BadRequest(new { success = false, message = exception.Message });
            }
            catch (ConflictException exception)
            {
                return Results.Conflict(new { success = false, message = exception.Message });
            }
        })
        .WithName("CreateCommissionRule")
        .WithSummary("Tạo quy tắc hoa hồng")
        .WithDescription("Admin cấu hình mức hoa hồng theo loại dịch vụ và mốc hoa hồng. Job chỉ lưu serviceTypeId.")
        .Produces<CreateCommissionRuleResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status409Conflict);

        return app;
    }

    // commission.manage is the permission seeded for managing commission rules (DatabaseSeeder).
    private static bool HasAdminAccess(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "commission.manage") ||
        user.HasClaim("permission", "system_config.manage");

    private static IResult Forbidden() => Results.Json(new
    {
        success = false,
        message = "Bạn không có quyền thực hiện thao tác này. Yêu cầu quyền quản trị viên."
    }, statusCode: StatusCodes.Status403Forbidden);

    private static IResult ValidationProblem(FluentValidation.Results.ValidationResult validationResult) =>
        Results.BadRequest(new
        {
            success = false,
            message = "Du lieu yeu cau khong hop le.",
            errors = validationResult.Errors
                .GroupBy(error => error.PropertyName)
                .ToDictionary(
                    group => group.Key,
                    group => group.Select(error => error.ErrorMessage).ToArray())
        });
}
