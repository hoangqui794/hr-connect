using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using MediatR;

namespace HRConnect.Application.Features.Candidates.JobMatches;

/// <summary>BE-04 C: candidate_job_match.status values.</summary>
public static class JobMatchStates
{
    public const string Generated = "GENERATED";
    /// <summary>The AI could not read the CV; kept so the same pair is not retried every cycle.</summary>
    public const string Failed = "FAILED";
}

public sealed record JobMatchScore(Guid CvId, decimal? Score, string? Error);

/// <summary>Semantic CV↔JD score from the AI service (POST /api/v1/semantic-match, no LLM).</summary>
public interface IJobMatchAiClient
{
    Task<IReadOnlyList<JobMatchScore>> ScoreAsync(Guid jobId, IReadOnlyList<Guid> cvIds, CancellationToken cancellationToken = default);
}

public sealed record JobMatchDto(
    Guid CandidateJobMatchId, Guid JobId, string JobTitle, string CompanyName, string? Location,
    decimal MatchScore, DateTime GeneratedAt, DateTime? ExpiresAt);

public interface IJobMatchReader
{
    /// <summary>Unexpired GENERATED matches at or above minScore whose job is still ACTIVE, best first.</summary>
    Task<IReadOnlyList<JobMatchDto>> GetForCandidateAsync(
        Guid candidateId, decimal minScore, int take, DateTime now, CancellationToken cancellationToken = default);
}

public sealed record GetMyJobMatchesQuery(Guid UserId) : IRequest<IReadOnlyList<JobMatchDto>>;

public sealed class GetMyJobMatchesQueryHandler : IRequestHandler<GetMyJobMatchesQuery, IReadOnlyList<JobMatchDto>>
{
    private const int MaxSuggestions = 20;
    private readonly ICandidateRepository _candidates;
    private readonly IJobMatchReader _reader;
    private readonly IAdminBusinessSettings _settings;

    public GetMyJobMatchesQueryHandler(ICandidateRepository candidates, IJobMatchReader reader, IAdminBusinessSettings settings)
    {
        _candidates = candidates;
        _reader = reader;
        _settings = settings;
    }

    public async Task<IReadOnlyList<JobMatchDto>> Handle(GetMyJobMatchesQuery request, CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên.");
        var minScore = await _settings.GetDecimalAsync(BusinessSettingKeys.JobMatchMinScore, cancellationToken);
        return await _reader.GetForCandidateAsync(candidate.CandidateId, minScore, MaxSuggestions, DateTime.UtcNow, cancellationToken);
    }
}
