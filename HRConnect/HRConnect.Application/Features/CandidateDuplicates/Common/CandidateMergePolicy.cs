namespace HRConnect.Application.Features.CandidateDuplicates.Common;

public static class CandidateMergePolicy
{
    public static (HRConnect.Domain.Entities.Candidate Canonical,
        HRConnect.Domain.Entities.Candidate Source,
        string Reason) RecommendCanonical(
        HRConnect.Domain.Entities.Candidate left,
        HRConnect.Domain.Entities.Candidate right,
        IReadOnlyList<HRConnect.Domain.Entities.Submission> submissions,
        IReadOnlyList<HRConnect.Domain.Entities.Application> applications)
    {
        if (left.UserId.HasValue != right.UserId.HasValue)
            return left.UserId.HasValue
                ? (left, right, "VERIFIED_ACCOUNT_OWNER")
                : (right, left, "VERIFIED_ACCOUNT_OWNER");

        var leftBusinessCount = submissions.Count(item => item.CandidateId == left.CandidateId) +
                                applications.Count(item => item.CandidateId == left.CandidateId);
        var rightBusinessCount = submissions.Count(item => item.CandidateId == right.CandidateId) +
                                 applications.Count(item => item.CandidateId == right.CandidateId);
        if (leftBusinessCount != rightBusinessCount)
            return leftBusinessCount > rightBusinessCount
                ? (left, right, "MORE_VALID_BUSINESS_HISTORY")
                : (right, left, "MORE_VALID_BUSINESS_HISTORY");

        if (left.CreatedAt != right.CreatedAt)
            return left.CreatedAt < right.CreatedAt
                ? (left, right, "EARLIEST_CANDIDATE_RECORD")
                : (right, left, "EARLIEST_CANDIDATE_RECORD");

        return string.CompareOrdinal(left.CandidateId.ToString("N"), right.CandidateId.ToString("N")) <= 0
            ? (left, right, "DETERMINISTIC_CANDIDATE_ID_TIE_BREAK")
            : (right, left, "DETERMINISTIC_CANDIDATE_ID_TIE_BREAK");
    }

    public static IReadOnlyList<HRConnect.Domain.Entities.Submission> OrderConfirmedCandidates(
        IEnumerable<HRConnect.Domain.Entities.Submission> submissions) =>
        submissions
            .Where(item => item.Consent is { Status: "CONFIRMED", RespondedAt: not null } &&
                           item.Status is "ACCEPTED" or "PENDING_IDENTITY_REVIEW")
            .OrderBy(item => item.Consent!.RespondedAt)
            .ThenBy(item => item.SubmittedAt)
            .ThenBy(item => item.SubmissionId)
            .ToArray();

    public static HRConnect.Domain.Entities.Submission? SelectEarliestConfirmedWinner(
        IEnumerable<HRConnect.Domain.Entities.Submission> submissions) =>
        OrderConfirmedCandidates(submissions).FirstOrDefault();

    public static bool HasCompletedPayout(IEnumerable<HRConnect.Domain.Entities.Application> applications) =>
        applications.Any(application => application.Attribution?.Commissions.Any(
            commission => commission.Payouts.Any(payout => payout.Status == "COMPLETED")) == true);
}
