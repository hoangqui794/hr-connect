using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Integration;

public class Mf03ScoringTrigger : IMf03ScoringTrigger
{
    private readonly ILogger<Mf03ScoringTrigger> _logger;
    private readonly ApplicationDbContext _context;
    private readonly IAuditLogService _audit;

    public Mf03ScoringTrigger(
        ApplicationDbContext context,
        ILogger<Mf03ScoringTrigger> logger,
        IAuditLogService audit)
    {
        _context = context;
        _logger = logger;
        _audit = audit;
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

        await _audit.AddAsync(new AuditEntry
        {
            ActorUserId = payload.ActorUserId,
            Action = payload.Reason switch
            {
                Mf03ScoringReasons.Initial => "AI_SCORING_REQUESTED",
                Mf03ScoringReasons.FailedRetry => "AI_SCORING_RETRY_REQUESTED",
                _ => "AI_SCORING_RESCORE_REQUESTED"
            },
            EntityType = "APPLICATION",
            EntityId = payload.ApplicationId,
            NewValues = new
            {
                status = "PENDING",
                attemptNo = attemptNo + 1,
                cvId = payload.CvId,
                jobId = payload.JobId,
                reason = payload.Reason
            },
            CorrelationId = requestId,
            Source = AuditSources.Integration,
            ServiceName = "MF02_MF03_TRIGGER"
        }, cancellationToken);

        _logger.LogInformation(
            "Queued MF-03 scoring request {RequestId}: ApplicationId={ApplicationId}, CvId={CvId}, JobId={JobId}, AttemptNo={AttemptNo}, Reason={Reason}.",
            requestId, payload.ApplicationId, payload.CvId, payload.JobId, attemptNo + 1, payload.Reason);
    }
}
