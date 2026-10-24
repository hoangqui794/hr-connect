namespace HRConnect.Application.Common.Email;

/// <summary>
/// Serialized into EmailOutbox.Payload for recruitment notifications sent to a
/// Candidate who has not linked a HR Connect account yet. Do not add offer salary,
/// file URLs, CV content, or other sensitive documents to this payload.
/// </summary>
public sealed record RecruitmentCandidateEmailPayload(
    string CandidateName,
    string JobTitle,
    string? CompanyName,
    string PortalUrl,
    int? InterviewRound = null,
    DateTime? ScheduledAt = null,
    int? DurationMinutes = null,
    string? InterviewType = null,
    string? Location = null,
    string? MeetingLink = null,
    DateOnly? ExpiryDate = null,
    string? Reason = null);

public static class RecruitmentCandidateEmailTemplates
{
    public const string InterviewScheduled = "CANDIDATE_INTERVIEW_SCHEDULED";
    public const string InterviewUpdated = "CANDIDATE_INTERVIEW_UPDATED";
    public const string InterviewRescheduled = "CANDIDATE_INTERVIEW_RESCHEDULED";
    public const string InterviewCancelled = "CANDIDATE_INTERVIEW_CANCELLED";
    public const string OfferSent = "CANDIDATE_OFFER_SENT";
    public const string OfferWithdrawn = "CANDIDATE_OFFER_WITHDRAWN";
    public const string OfferExpired = "CANDIDATE_OFFER_EXPIRED";
    public const string ApplicationNotStartedReported = "CANDIDATE_NOT_STARTED_REPORTED";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        InterviewScheduled,
        InterviewUpdated,
        InterviewRescheduled,
        InterviewCancelled,
        OfferSent,
        OfferWithdrawn,
        OfferExpired,
        ApplicationNotStartedReported
    };
}
