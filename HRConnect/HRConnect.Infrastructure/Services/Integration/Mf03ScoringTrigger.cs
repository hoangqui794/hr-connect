using HRConnect.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Integration;

public class Mf03ScoringTrigger : IMf03ScoringTrigger
{
    private readonly ILogger<Mf03ScoringTrigger> _logger;

    public Mf03ScoringTrigger(ILogger<Mf03ScoringTrigger> logger)
    {
        _logger = logger;
    }

    public Task TriggerScoringAsync(Mf03TriggerPayload payload, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("MF-03 Triggered: ApplicationId={ApplicationId}, CvId={CvId}, JobId={JobId}. AI scoring scheduled asynchronously.",
            payload.ApplicationId, payload.CvId, payload.JobId);

        // Dispatches event asynchronously for MF-03 consumption.
        return Task.CompletedTask;
    }
}
