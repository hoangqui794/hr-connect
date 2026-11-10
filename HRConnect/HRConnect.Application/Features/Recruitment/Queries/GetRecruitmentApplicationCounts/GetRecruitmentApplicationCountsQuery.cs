using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationCounts;

/// <summary>
/// Application counts for the recruitment list in one call, grouped by job or by status, with the same
/// scope and filters as GET /recruitment/applications (C-07: the Client pages counted job by job).
/// </summary>
public sealed record GetRecruitmentApplicationCountsQuery(
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin,
    string GroupBy,
    Guid? JobId = null,
    string? Status = null,
    string? CandidateName = null,
    string? ServiceTypeCode = null) : IRequest<RecruitmentApplicationCountsResponse>;

public sealed class RecruitmentApplicationCountsResponse
{
    public bool Success { get; init; } = true;
    public string Message { get; init; } = string.Empty;
    public RecruitmentApplicationCountsData Data { get; init; } = new();
}

public sealed class RecruitmentApplicationCountsData
{
    /// <summary>"job" or "status".</summary>
    public string GroupBy { get; init; } = string.Empty;
    public int Total { get; init; }
    /// <summary>Key is the job id or the application status; groups with no application are left out.</summary>
    public IReadOnlyDictionary<string, int> Counts { get; init; } = new Dictionary<string, int>();
}
