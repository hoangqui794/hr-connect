using System.Text.Json;
using HRConnect.Infrastructure.Authentication;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Presentation.Swagger;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Presentation.Endpoints.Internal;

public static class AiIntegrationEndpoints
{
    public static IEndpointRouteBuilder MapAiIntegrationEndpoints(this IEndpointRouteBuilder app)
    {
        var groups = new[]
        {
            CreateProtectedGroup(app, "/api/v1/internal"),
            CreateProtectedGroup(app, "/api/internal") // Temporary compatibility alias.
        };

        foreach (var group in groups)
        {

        group.MapGet("/jobs/{jobId:guid}/jd", async (
            Guid jobId,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var job = await db.Jobs.AsNoTracking()
                .Include(item => item.JobRequirements)
                .Include(item => item.JobSkills).ThenInclude(item => item.Skill)
                .FirstOrDefaultAsync(item => item.JobId == jobId, ct);
            if (job == null) return Results.NotFound();

            var requirementNames = new HashSet<string>(
                job.JobRequirements.Select(item => item.Content),
                StringComparer.OrdinalIgnoreCase);
            var requirements = job.JobRequirements.Select(item => new
            {
                type = NormalizeRequirementType(item.RequirementType),
                category = NormalizeCategory(item.Category),
                item.Content
            }).Cast<object>().ToList();

            foreach (var item in job.JobSkills)
            {
                if (!requirementNames.Add(item.Skill.SkillName)) continue;

                requirements.Add(new
                {
                    type = item.IsMandatory ? "MUST_HAVE" : "SHOULD_HAVE",
                    category = "SKILL",
                    content = item.Skill.SkillName
                });
            }

            return Results.Ok(new
            {
                jobId = job.JobId,
                job.Title,
                description = string.IsNullOrWhiteSpace(job.Description) ? job.Title : job.Description,
                requirements,
                updatedAt = job.UpdatedAt
            });
        });

        group.MapGet("/ai-results/{applicationId:guid}", async (
            Guid applicationId,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var result = await db.AiMatchResults.AsNoTracking()
                .Where(item => item.ApplicationId == applicationId)
                .OrderByDescending(item => item.AttemptNo)
                .Select(item => new
                {
                    item.ApplicationId,
                    item.AttemptNo,
                    item.Status,
                    item.MatchScore,
                    item.MatchTier,
                    item.CandidateHighlight,
                    item.MustHaveResult,
                    item.ShouldHaveResult,
                    item.ErrorMessage,
                    item.RequestedAt,
                    item.CompletedAt
                })
                .FirstOrDefaultAsync(ct);

            if (result == null) return Results.NotFound();
            return Results.Ok(result);
        });

        group.MapPost("/ai-results", async (
            AiResultCallback payload,
            ApplicationDbContext db,
            CancellationToken ct) =>
        {
            var result = await db.AiMatchResults
                .Include(item => item.Application).ThenInclude(item => item.Submission)
                .FirstOrDefaultAsync(item => item.ApplicationId == payload.ApplicationId &&
                    item.AttemptNo == payload.AttemptNo, ct);

            if (result == null) return Results.NotFound();
            if (!string.Equals(result.ExternalReference, payload.RequestId, StringComparison.Ordinal))
                return Results.BadRequest(new { message = "Request identifier does not match the scoring attempt." });
            if (result.Application.JobId != payload.JobId || result.Application.Submission?.CvId != payload.CvId)
                return Results.BadRequest(new { message = "Callback identifiers do not match the application." });

            if (payload.Status == "COMPLETED")
            {
                if (payload.Score is < 0 or > 100)
                    return Results.BadRequest(new { message = "Score must be between 0 and 100." });

                var tier = payload.Score.HasValue
                    ? await db.MatchTierConfigs.AsNoTracking()
                        .Where(item => item.IsActive && payload.Score >= item.MinScore && payload.Score <= item.MaxScore)
                        .OrderBy(item => item.DisplayOrder)
                        .Select(item => item.TierCode)
                        .FirstOrDefaultAsync(ct)
                    : null;

                result.MatchScore = payload.Score;
                result.MatchTier = tier;
                result.CandidateHighlight = payload.CandidateHighlights?.GetRawText();
                result.MustHaveResult = payload.MustHaveResult?.GetRawText();
                result.ShouldHaveResult = payload.ShouldHaveResult?.GetRawText();
                result.RawResponse = JsonSerializer.Serialize(payload);
                result.Status = "COMPLETED";
                result.ErrorMessage = null;
                result.CompletedAt = DateTime.UtcNow;

                if (payload.StructuredCvData.HasValue)
                {
                    var cv = await db.CandidateCvs.FirstAsync(item => item.CvId == payload.CvId, ct);
                    cv.ParsedData = payload.StructuredCvData.Value.GetRawText();
                    cv.UpdatedAt = DateTime.UtcNow;
                }
            }
            else if (payload.Status == "FAILED")
            {
                result.Status = "FAILED";
                result.ErrorMessage = payload.ErrorMessage;
                result.RawResponse = JsonSerializer.Serialize(payload);
                result.CompletedAt = DateTime.UtcNow;
            }
            else
            {
                return Results.BadRequest(new { message = "Status must be COMPLETED or FAILED." });
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { success = true });
        });

        }

        return app;
    }

    private static RouteGroupBuilder CreateProtectedGroup(IEndpointRouteBuilder app, string prefix) =>
        app.MapGroup(prefix)
            .WithTags("Internal AI Integration")
            .WithMetadata(new InternalServiceAuthAttribute())
            .AddEndpointFilter<InternalServiceAuthFilter>();

    private static string NormalizeRequirementType(string value) =>
        value.Equals("MUST_HAVE", StringComparison.OrdinalIgnoreCase) ? "MUST_HAVE" : "SHOULD_HAVE";

    private static string NormalizeCategory(string? value) => value?.ToUpperInvariant() switch
    {
        "SKILL" or "EXPERIENCE" or "EDUCATION" => value.ToUpperInvariant(),
        _ => "OTHER"
    };
}

public sealed record AiResultCallback(
    string RequestId,
    Guid ApplicationId,
    Guid CvId,
    Guid JobId,
    int AttemptNo,
    string Status,
    decimal? Score,
    JsonElement? CandidateHighlights,
    JsonElement? MustHaveResult,
    JsonElement? ShouldHaveResult,
    JsonElement? StructuredCvData,
    string? ModelVersion,
    string? ErrorMessage);
