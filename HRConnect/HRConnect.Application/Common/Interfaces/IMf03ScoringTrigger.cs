namespace HRConnect.Application.Common.Interfaces;

public static class Mf03ScoringReasons
{
    public const string Initial = "INITIAL";
    public const string FailedRetry = "FAILED_RETRY";
    public const string JdUpdated = "JD_UPDATED";
    public const string ManualReview = "MANUAL_REVIEW";

    public static bool IsRetryOrRescore(string value) =>
        value is FailedRetry or JdUpdated or ManualReview;
}

public record Mf03TriggerPayload(
    Guid ApplicationId,
    Guid CvId,
    Guid JobId,
    Guid ActorUserId,
    string Reason = Mf03ScoringReasons.Initial);

/// <summary>
/// Asynchronous trigger contract between MF-02 and MF-03.
/// MF-02 triggers MF-03 with (applicationId, cvId, jobId) without waiting for AI processing.
/// </summary>
public interface IMf03ScoringTrigger
{
    Task TriggerScoringAsync(Mf03TriggerPayload payload, CancellationToken cancellationToken = default);
}
