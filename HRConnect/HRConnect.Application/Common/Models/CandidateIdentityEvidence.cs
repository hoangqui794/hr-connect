namespace HRConnect.Application.Common.Models;

public sealed record CandidateIdentityEvidence(
    bool IsEnabled,
    string? NormalizedNameHash,
    string? EmailHmac,
    string? PhoneHmac,
    string? KeyVersion);

public sealed record CandidateDuplicateMatch(
    Guid CandidateId,
    Guid SubmissionId,
    bool HasSameJobHistory);
