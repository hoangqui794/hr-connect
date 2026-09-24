namespace HRConnect.Application.Common.Interfaces;

public record Mf03TriggerPayload(Guid ApplicationId, Guid CvId, Guid JobId, Guid ActorUserId);

/// <summary>
/// Asynchronous trigger contract between MF-02 and MF-03.
/// MF-02 triggers MF-03 with (applicationId, cvId, jobId) without waiting for AI processing.
/// </summary>
public interface IMf03ScoringTrigger
{
    Task TriggerScoringAsync(Mf03TriggerPayload payload, CancellationToken cancellationToken = default);
}
