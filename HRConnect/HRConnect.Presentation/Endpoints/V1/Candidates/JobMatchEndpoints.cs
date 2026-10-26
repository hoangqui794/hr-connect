using System.Security.Claims;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.Candidates.JobMatches;
using HRConnect.Presentation.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace HRConnect.Presentation.Endpoints.V1.Candidates;

/// <summary>BE-04 C: AI job suggestions for the signed-in candidate.</summary>
public static class JobMatchEndpoints
{
    private const string Permission = "candidate.profile.view_own";

    public static IEndpointRouteBuilder MapJobMatchEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/candidates/me/job-matches", async (ClaimsPrincipal user, [FromServices] ISender sender, CancellationToken ct) =>
            {
                var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
                if (!Guid.TryParse(idClaim, out var userId)) return Results.Unauthorized();
                if (!PermissionAuthorization.HasPermission(user, Permission)) return PermissionAuthorization.Forbidden(Permission);
                try
                {
                    var result = await sender.Send(new GetMyJobMatchesQuery(userId), ct);
                    return Results.Ok(new { success = true, data = result.Items, meta = result.Meta });
                }
                catch (NotFoundException ex)
                {
                    return Results.NotFound(new { success = false, message = ex.Message });
                }
            })
            .RequireAuthorization()
            .WithTags("Candidate Job Matches")
            .WithName("GetMyJobMatches")
            .WithSummary("Việc làm phù hợp với CV chính")
            .WithDescription("Hệ thống kết hợp độ tương đồng CV-JD với kỹ năng và thông tin nghề nghiệp để trả tối đa 20 gợi ý còn hạn, chưa ứng tuyển, xếp theo mức phù hợp. Hồ sơ công khai hay riêng tư không ảnh hưởng gợi ý chỉ dành cho chính Candidate.");

        app.MapPost("/api/v1/candidates/me/job-matches/{matchId:guid}/dismiss", async (
                Guid matchId,
                ClaimsPrincipal user,
                [FromServices] ISender sender,
                CancellationToken ct) =>
            {
                var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
                if (!Guid.TryParse(idClaim, out var userId)) return Results.Unauthorized();
                if (!PermissionAuthorization.HasPermission(user, Permission)) return PermissionAuthorization.Forbidden(Permission);
                try
                {
                    await sender.Send(new DismissMyJobMatchCommand(userId, matchId), ct);
                    return Results.Ok(new { success = true, message = "Đã ẩn gợi ý việc làm." });
                }
                catch (NotFoundException ex)
                {
                    return Results.NotFound(new { success = false, message = ex.Message });
                }
            })
            .RequireAuthorization()
            .WithTags("Candidate Job Matches")
            .WithName("DismissMyJobMatch")
            .WithSummary("Ẩn một gợi ý việc làm");

        return app;
    }
}
