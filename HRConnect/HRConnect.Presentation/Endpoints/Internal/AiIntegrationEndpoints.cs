using System.Text.Json;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Authentication;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Presentation.Swagger;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

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
                    item.FailureCode,
                    item.ModelVersion,
                    item.RequestedAt,
                    item.ProcessingStartedAt,
                    item.LastDispatchedAt,
                    item.DispatchCount,
                    item.CompletedAt
                })
                .FirstOrDefaultAsync(ct);

            if (result == null) return Results.NotFound();
            return Results.Ok(result);
        });

        group.MapPost("/ai-results", async (
            AiResultCallback payload,
            ApplicationDbContext db,
            ILoggerFactory loggerFactory,
            CancellationToken ct) =>
            await AiResultCallbackProcessor.ProcessAsync(
                payload,
                db,
                loggerFactory.CreateLogger("MF03.AiResultCallback"),
                ct));

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
    string? ErrorCode,
    string? ErrorMessage);

public static class AiResultCallbackProcessor
{
    public static async Task<IResult> ProcessAsync(
        AiResultCallback payload,
        ApplicationDbContext db,
        CancellationToken ct) =>
        await ProcessAsync(payload, db, NullLogger.Instance, ct);

    public static async Task<IResult> ProcessAsync(
        AiResultCallback payload,
        ApplicationDbContext db,
        ILogger logger,
        CancellationToken ct)
    {
        var result = await db.AiMatchResults
            .Include(item => item.Application).ThenInclude(item => item.Submission)
            .FirstOrDefaultAsync(item => item.ApplicationId == payload.ApplicationId &&
                item.AttemptNo == payload.AttemptNo, ct);

        if (result == null)
        {
            logger.LogWarning(
                "MF-03 callback did not match an attempt: RequestId={RequestId}, ApplicationId={ApplicationId}, AttemptNo={AttemptNo}.",
                payload.RequestId, payload.ApplicationId, payload.AttemptNo);
            return Results.NotFound();
        }
        if (!string.Equals(result.ExternalReference, payload.RequestId, StringComparison.Ordinal))
        {
            logger.LogWarning(
                "Rejected MF-03 callback with mismatched RequestId={RequestId} for ApplicationId={ApplicationId}, AttemptNo={AttemptNo}.",
                payload.RequestId, payload.ApplicationId, payload.AttemptNo);
            return Results.BadRequest(new { message = "Request identifier does not match the scoring attempt." });
        }
        if (result.Application.JobId != payload.JobId || result.Application.Submission?.CvId != payload.CvId)
        {
            logger.LogWarning(
                "Rejected MF-03 callback with mismatched identifiers: RequestId={RequestId}, ApplicationId={ApplicationId}, CvId={CvId}, JobId={JobId}.",
                payload.RequestId, payload.ApplicationId, payload.CvId, payload.JobId);
            return Results.BadRequest(new { message = "Callback identifiers do not match the application." });
        }

        if (result.Status is "COMPLETED" or "FAILED")
        {
            if (string.Equals(result.Status, payload.Status, StringComparison.Ordinal))
            {
                logger.LogInformation(
                    "Accepted idempotent MF-03 callback {RequestId} with terminal status {Status}.",
                    payload.RequestId, payload.Status);
                return Results.Ok(new { success = true, idempotent = true });
            }

            logger.LogWarning(
                "Rejected MF-03 callback {RequestId}: existing terminal status {ExistingStatus}, incoming status {IncomingStatus}.",
                payload.RequestId, result.Status, payload.Status);
            return Results.Conflict(new
            {
                message = $"Scoring attempt is already terminal with status {result.Status}."
            });
        }

        var previousStatus = result.Status;
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
            result.RawResponse = SerializeSafeCallback(payload);
            result.Status = "COMPLETED";
            result.ModelVersion = payload.ModelVersion;
            result.FailureCode = null;
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
            result.FailureCode = string.IsNullOrWhiteSpace(payload.ErrorCode)
                ? "AI_SCORING_FAILED"
                : payload.ErrorCode;
            result.ErrorMessage = payload.ErrorMessage;
            result.ModelVersion = payload.ModelVersion;
            result.RawResponse = SerializeSafeCallback(payload);
            result.CompletedAt = DateTime.UtcNow;
        }
        else
        {
            return Results.BadRequest(new { message = "Status must be COMPLETED or FAILED." });
        }

        db.AuditLogs.Add(CreateResultAudit(result, previousStatus));
        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Persisted MF-03 callback {RequestId}: ApplicationId={ApplicationId}, AttemptNo={AttemptNo}, Status={Status}, ModelVersion={ModelVersion}, FailureCode={FailureCode}.",
            payload.RequestId, payload.ApplicationId, payload.AttemptNo, result.Status, result.ModelVersion, result.FailureCode);
        return Results.Ok(new { success = true });
    }

    private static string SerializeSafeCallback(AiResultCallback payload) => JsonSerializer.Serialize(new
    {
        payload.RequestId,
        payload.ApplicationId,
        payload.CvId,
        payload.JobId,
        payload.AttemptNo,
        payload.Status,
        payload.Score,
        payload.CandidateHighlights,
        payload.MustHaveResult,
        payload.ShouldHaveResult,
        payload.ModelVersion,
        payload.ErrorCode,
        payload.ErrorMessage
    });

    private static AuditLog CreateResultAudit(AiMatchResult result, string previousStatus)
    {
        Guid? correlationId = Guid.TryParse(result.ExternalReference, out var parsed) ? parsed : null;
        return new AuditLog
        {
            Action = result.Status == "COMPLETED" ? "AI_SCORING_COMPLETED" : "AI_SCORING_FAILED",
            EntityType = "APPLICATION",
            EntityId = result.ApplicationId,
            OldValues = JsonSerializer.Serialize(new { status = previousStatus }),
            NewValues = JsonSerializer.Serialize(new
            {
                status = result.Status,
                attemptNo = result.AttemptNo,
                score = result.MatchScore,
                modelVersion = result.ModelVersion,
                failureCode = result.FailureCode
            }),
            CorrelationId = correlationId,
            CreatedAt = DateTime.UtcNow
        };
    }
}
