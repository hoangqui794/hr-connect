using System.Security.Claims;
using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;
using HRConnect.Application.Features.Candidates.Commands.RemoveCandidateSkill;
using HRConnect.Application.Features.Candidates.Commands.ReplaceCandidateSkills;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateSkill;
using HRConnect.Application.Features.Candidates.Queries.GetActiveSkills;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Candidates;

public static class CandidateSkillEndpoints
{
    private const string ViewOwnProfilePermission = "candidate.profile.view_own";
    private const string UpdateOwnProfilePermission = "candidate.profile.update_own";

    public static IEndpointRouteBuilder MapCandidateSkillEndpoints(this IEndpointRouteBuilder app)
    {
        var catalogGroup = app.MapGroup("/api/v1/skills")
            .WithTags("Skills")
            .RequireAuthorization();

        catalogGroup.MapGet("", async (
            [FromQuery] string? search,
            ClaimsPrincipal user,
            ISender sender,
            CancellationToken cancellationToken,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
        {
            if (!PermissionAuthorization.HasPermission(user, ViewOwnProfilePermission))
            {
                return PermissionAuthorization.Forbidden(ViewOwnProfilePermission);
            }

            if (search?.Length > 100)
            {
                return Results.BadRequest(new { success = false, message = "Từ khóa tìm kiếm không được vượt quá 100 ký tự." });
            }

            var result = await sender.Send(new GetActiveSkillsQuery(search, page, pageSize), cancellationToken);
            return Results.Ok(result);
        })
        .WithName("GetActiveSkills")
        .WithSummary("Lấy danh mục kỹ năng đang hoạt động")
        .WithDescription("Dành cho Candidate chọn kỹ năng khi cập nhật hồ sơ. Chỉ trả về skill đang hoạt động, hỗ trợ tìm theo tên hoặc nhóm kỹ năng và phân trang.")
        .Produces<GetActiveSkillsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden);

        var profileGroup = app.MapGroup("/api/v1/candidates/profile/me/skills")
            .WithTags("Candidate Skills")
            .RequireAuthorization();

        profileGroup.MapPut("", async (
            [FromBody] ReplaceCandidateSkillsCommand command,
            ClaimsPrincipal user,
            ISender sender,
            IValidator<ReplaceCandidateSkillsCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();
            if (!PermissionAuthorization.HasPermission(user, UpdateOwnProfilePermission))
                return PermissionAuthorization.Forbidden(UpdateOwnProfilePermission);

            command.UserId = userId.Value;
            var errors = await GetValidationErrorsAsync(validator, command, cancellationToken);
            if (errors != null) return errors;

            try
            {
                return Results.Ok(await sender.Send(command, cancellationToken));
            }
            catch (Exception exception)
            {
                return ToErrorResult(exception);
            }
        })
        .WithName("ReplaceCandidateSkills")
        .WithSummary("Thay toàn bộ danh sách kỹ năng của Candidate")
        .WithDescription("Thay thế atomically toàn bộ candidate_skill của Candidate đang đăng nhập. Gửi mảng rỗng để xóa toàn bộ kỹ năng.")
        .Produces<ReplaceCandidateSkillsResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        profileGroup.MapPost("", async (
            [FromBody] AddCandidateSkillCommand command,
            ClaimsPrincipal user,
            ISender sender,
            IValidator<AddCandidateSkillCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();
            if (!PermissionAuthorization.HasPermission(user, UpdateOwnProfilePermission))
                return PermissionAuthorization.Forbidden(UpdateOwnProfilePermission);

            command.UserId = userId.Value;
            var errors = await GetValidationErrorsAsync(validator, command, cancellationToken);
            if (errors != null) return errors;

            try
            {
                var result = await sender.Send(command, cancellationToken);
                return Results.Created($"/api/v1/candidates/profile/me/skills/{result.Data.SkillId}", result);
            }
            catch (Exception exception)
            {
                return ToErrorResult(exception);
            }
        })
        .WithName("AddCandidateSkill")
        .WithSummary("Thêm một kỹ năng vào hồ sơ Candidate")
        .Produces<CandidateSkillMutationResponse>(StatusCodes.Status201Created)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound)
        .Produces(StatusCodes.Status409Conflict);

        profileGroup.MapPatch("/{skillId:guid}", async (
            Guid skillId,
            [FromBody] UpdateCandidateSkillCommand command,
            ClaimsPrincipal user,
            ISender sender,
            IValidator<UpdateCandidateSkillCommand> validator,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();
            if (!PermissionAuthorization.HasPermission(user, UpdateOwnProfilePermission))
                return PermissionAuthorization.Forbidden(UpdateOwnProfilePermission);

            command.UserId = userId.Value;
            command.SkillId = skillId;
            var errors = await GetValidationErrorsAsync(validator, command, cancellationToken);
            if (errors != null) return errors;

            try
            {
                return Results.Ok(await sender.Send(command, cancellationToken));
            }
            catch (Exception exception)
            {
                return ToErrorResult(exception);
            }
        })
        .WithName("UpdateCandidateSkill")
        .WithSummary("Cập nhật mức thành thạo của một kỹ năng")
        .Produces<CandidateSkillMutationResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        profileGroup.MapDelete("/{skillId:guid}", async (
            Guid skillId,
            ClaimsPrincipal user,
            ISender sender,
            CancellationToken cancellationToken) =>
        {
            var userId = GetUserIdFromClaims(user);
            if (userId == null) return Results.Unauthorized();
            if (!PermissionAuthorization.HasPermission(user, UpdateOwnProfilePermission))
                return PermissionAuthorization.Forbidden(UpdateOwnProfilePermission);

            try
            {
                return Results.Ok(await sender.Send(new RemoveCandidateSkillCommand
                {
                    UserId = userId.Value,
                    SkillId = skillId
                }, cancellationToken));
            }
            catch (Exception exception)
            {
                return ToErrorResult(exception);
            }
        })
        .WithName("RemoveCandidateSkill")
        .WithSummary("Xóa một kỹ năng khỏi hồ sơ Candidate")
        .Produces<RemoveCandidateSkillResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status403Forbidden)
        .Produces(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult?> GetValidationErrorsAsync<T>(
        IValidator<T> validator,
        T command,
        CancellationToken cancellationToken)
    {
        var result = await validator.ValidateAsync(command, cancellationToken);
        if (result.IsValid) return null;

        return Results.BadRequest(new
        {
            success = false,
            message = "Dữ liệu kỹ năng không hợp lệ.",
            errors = result.Errors
                .GroupBy(error => error.PropertyName)
                .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage).ToArray())
        });
    }

    private static IResult ToErrorResult(Exception exception) => exception switch
    {
        NotFoundException => Results.NotFound(new { success = false, message = exception.Message }),
        ConflictException => Results.Conflict(new { success = false, message = exception.Message }),
        BadRequestException => Results.BadRequest(new { success = false, message = exception.Message }),
        _ => Results.Problem(detail: exception.Message, statusCode: StatusCodes.Status500InternalServerError)
    };

    private static Guid? GetUserIdFromClaims(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(idClaim, out var userId) ? userId : null;
    }
}
