using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace HRConnect.Infrastructure.Services.Integration;

public class Mf03ScoringTrigger : IMf03ScoringTrigger
{
    private readonly ILogger<Mf03ScoringTrigger> _logger;
    private readonly ApplicationDbContext _context;

    public Mf03ScoringTrigger(ApplicationDbContext context, ILogger<Mf03ScoringTrigger> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task TriggerScoringAsync(Mf03TriggerPayload payload, CancellationToken cancellationToken = default)
    {
        var attemptNo = await _context.AiMatchResults
            .Where(result => result.ApplicationId == payload.ApplicationId)
            .Select(result => (int?)result.AttemptNo)
            .MaxAsync(cancellationToken) ?? 0;

        var requestId = Guid.NewGuid();
        await _context.AiMatchResults.AddAsync(new AiMatchResult
        {
            MatchResultId = requestId,
            ApplicationId = payload.ApplicationId,
            AttemptNo = attemptNo + 1,
            ExternalReference = requestId.ToString(),
            Status = "PENDING",
            RequestedAt = DateTime.UtcNow
        }, cancellationToken);

        await _context.AuditLogs.AddAsync(new AuditLog
        {
            ActorUserId = payload.ActorUserId,
            Action = attemptNo == 0 ? "AI_SCORING_REQUESTED" : "AI_SCORING_RETRY_REQUESTED",
            EntityType = "APPLICATION",
            EntityId = payload.ApplicationId,
            NewValues = JsonSerializer.Serialize(new
            {
                status = "PENDING",
                attemptNo = attemptNo + 1,
                cvId = payload.CvId,
                jobId = payload.JobId
            }),
            CorrelationId = requestId,
            CreatedAt = DateTime.UtcNow
        }, cancellationToken);

        _logger.LogInformation(
            "Queued MF-03 scoring request {RequestId}: ApplicationId={ApplicationId}, CvId={CvId}, JobId={JobId}, AttemptNo={AttemptNo}.",
            requestId, payload.ApplicationId, payload.CvId, payload.JobId, attemptNo + 1);
    }
}
