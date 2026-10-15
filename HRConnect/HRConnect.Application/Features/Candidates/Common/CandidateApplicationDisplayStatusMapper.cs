using HRConnect.Domain.Constants;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Common;

public sealed record CandidateApplicationDisplayStatus(string Group, string Label);

/// <summary>
/// Candidate-facing projection of the internal recruitment lifecycle.
/// Internal workflow codes and reasons must never cross the Candidate API boundary.
/// </summary>
public static class CandidateApplicationDisplayStatusMapper
{
    public static readonly IReadOnlySet<string> AllowedGroups = new HashSet<string>(StringComparer.Ordinal)
    {
        "SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED", "NOT_SELECTED", "WITHDRAWN"
    };

    public static CandidateApplicationDisplayStatus Map(
        string? applicationStatus,
        IEnumerable<string?>? offerStatuses = null,
        ILogger? logger = null)
    {
        var normalizedStatus = applicationStatus?.Trim().ToUpperInvariant();
        var hasSentOffer = offerStatuses?.Any(status =>
            string.Equals(status, OfferStates.Sent, StringComparison.OrdinalIgnoreCase)) == true;

        return normalizedStatus switch
        {
            ApplicationStates.Submitted => new("SUBMITTED", "Đã nộp"),
            ApplicationStates.Screening or ApplicationStates.Shortlisted or ApplicationStates.Backup
                => new("IN_REVIEW", "Đang xem xét"),
            ApplicationStates.Interview => new("INTERVIEW", "Phỏng vấn"),
            ApplicationStates.OfferPending when hasSentOffer => new("OFFER", "Đã nhận lời mời"),
            ApplicationStates.OfferPending => new("IN_REVIEW", "Đang xem xét"),
            ApplicationStates.OfferAccepted or ApplicationStates.Placed => new("HIRED", "Đã tuyển"),
            ApplicationStates.Rejected or ApplicationStates.InterviewFailed or
                ApplicationStates.BackupNotSelected or ApplicationStates.Closed
                => new("NOT_SELECTED", "Chưa phù hợp"),
            ApplicationStates.Withdrawn or ApplicationStates.OfferDeclined or ApplicationStates.NotStarted
                => new("WITHDRAWN", "Đã rút"),
            _ => Unknown(normalizedStatus, logger)
        };
    }

    public static IReadOnlyCollection<string> GetInternalStatuses(string displayGroup) => displayGroup switch
    {
        "SUBMITTED" => [ApplicationStates.Submitted],
        "IN_REVIEW" => [ApplicationStates.Screening, ApplicationStates.Shortlisted, ApplicationStates.Backup, ApplicationStates.OfferPending],
        "INTERVIEW" => [ApplicationStates.Interview],
        "OFFER" => [ApplicationStates.OfferPending],
        "HIRED" => [ApplicationStates.OfferAccepted, ApplicationStates.Placed],
        "NOT_SELECTED" => [ApplicationStates.Rejected, ApplicationStates.InterviewFailed, ApplicationStates.BackupNotSelected, ApplicationStates.Closed],
        "WITHDRAWN" => [ApplicationStates.Withdrawn, ApplicationStates.OfferDeclined, ApplicationStates.NotStarted],
        _ => []
    };

    private static CandidateApplicationDisplayStatus Unknown(string? status, ILogger? logger)
    {
        logger?.LogWarning(
            "Gặp trạng thái Application chưa có public mapping cho Candidate. RawStatus={ApplicationStatus}",
            status ?? "<null>");
        return new CandidateApplicationDisplayStatus("IN_REVIEW", "Đang xem xét");
    }
}
