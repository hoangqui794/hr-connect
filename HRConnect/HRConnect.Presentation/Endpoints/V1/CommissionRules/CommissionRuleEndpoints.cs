using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.CommissionRules.Commands.CreateCommissionRule;
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
                    message = "Ban khong co quyen thuc hien thao tac nay. Yeu cau quyen quan tri vien."
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
        .WithSummary("Create a Commission Rule for a Service Type and milestone")
        .WithDescription("Platform Admin configures the rate used later by the commission engine. The Job stores only serviceTypeId; it never stores commissionRuleId.")
        .Produces<CreateCommissionRuleResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status409Conflict);

        return app;
    }

    private static bool HasAdminAccess(ClaimsPrincipal user) =>
        user.IsInRole("PLATFORM_ADMIN") ||
        user.HasClaim("permission", "service_type.manage") ||
        user.HasClaim("permission", "system_config.manage");
}
