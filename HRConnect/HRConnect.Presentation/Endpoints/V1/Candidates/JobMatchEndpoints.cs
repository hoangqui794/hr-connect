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
                    return Results.Ok(new { success = true, data = await sender.Send(new GetMyJobMatchesQuery(userId), ct) });
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
            .WithDescription("AI so CV chính (hồ sơ PUBLIC) với JD các tin ACTIVE theo định kỳ. Trả tối đa 20 gợi ý còn hạn, điểm từ job_match.min_score trở lên, chưa ứng tuyển, xếp theo điểm. Quyền candidate.profile.view_own.");

        return app;
    }
}
