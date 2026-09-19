using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Jobs;

public static class JobEndpoints
{
    public static IEndpointRouteBuilder MapJobEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/jobs")
            .WithTags("Jobs")
            .RequireAuthorization();

        group.MapPost(string.Empty, async (
            ClaimsPrincipal user,
            [FromBody] CreateJobCommand command,
            [FromServices] ISender sender,
            [FromServices] IValidator<CreateJobCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserId(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            if (!CanCreateJob(user))
            {
                return Results.Json(new
                {
                    success = false,
                    message = "Bạn không có quyền tạo công việc."
                }, statusCode: StatusCodes.Status403Forbidden);
            }

            command.UserId = userId.Value;

            var validationResult = await validator.ValidateAsync(command, cancellationToken);
            if (!validationResult.IsValid)
            {
                return Results.BadRequest(new
                {
                    success = false,
                    message = "Dữ liệu tạo bản nháp công việc không hợp lệ.",
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
                return Results.Created($"/api/v1/jobs/{result.Data.JobId}", result);
            }
            catch (ForbiddenException ex)
            {
                return Results.Json(
                    new { success = false, message = ex.Message },
                    statusCode: StatusCodes.Status403Forbidden);
            }
            catch (BadRequestException ex)
            {
                return Results.BadRequest(new { success = false, message = ex.Message });
            }
        })
        .WithName("CreateJobDraft")
        .WithSummary("Tạo bản nháp công việc")
        .WithDescription("Client Company User tạo Job ở trạng thái DRAFT. Bản nháp có thể chưa đủ dữ liệu để submit xét duyệt.")
        .Produces<CreateJobResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        return app;
    }

    private static bool CanCreateJob(ClaimsPrincipal user) =>
        user.IsInRole("CLIENT_COMPANY_USER") && user.HasClaim("permission", "job.create");

    private static Guid? GetUserId(ClaimsPrincipal user)
    {
        var value = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(value, out var userId) ? userId : null;
    }
}
