using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Settings;
using MediatR;

namespace HRConnect.Application.Features.Candidates.JobMatches;

/// <summary>BE-04 C: candidate_job_match.status values.</summary>
public static class JobMatchStates
{
    public const string Generated = "GENERATED";
    /// <summary>The semantic service could not score the CV; retried with bounded backoff.</summary>
    public const string Failed = "FAILED";
    public const string Dismissed = "DISMISSED";
}

public sealed record JobMatchScore(Guid CvId, decimal? Score, string? Error);

/// <summary>Semantic CV↔JD score from the existing AI v2 service (POST /api/v1/semantic-match).</summary>
public interface IJobMatchAiClient
{
    Task<IReadOnlyList<JobMatchScore>> ScoreAsync(Guid jobId, IReadOnlyList<Guid> cvIds, CancellationToken cancellationToken = default);
}

public sealed record JobMatchDto(
    Guid CandidateJobMatchId,
    Guid JobId,
    string JobTitle,
    string CompanyName,
    string? CompanyLogoUrl,
    string? Location,
    string? EmploymentType,
    decimal? SalaryMin,
    decimal? SalaryMax,
    bool SalaryNegotiable,
    string CurrencyCode,
    decimal MatchScore,
    string? MatchTier,
    string? MatchTierLabel,
    IReadOnlyList<string> MatchingReasons,
    IReadOnlyList<string> MissingRequirements,
    DateTime GeneratedAt,
    DateTime? ApplicationDeadline,
    DateTime? ExpiresAt);

public sealed record JobMatchFeedMeta(bool HasPrimaryCv, DateTime? LastGeneratedAt, string ScoringVersion);

public sealed record JobMatchFeedDto(IReadOnlyList<JobMatchDto> Items, JobMatchFeedMeta Meta);

public interface IJobMatchReader
{
    /// <summary>Newest unexpired GENERATED result per job at or above minScore, best first.</summary>
    Task<JobMatchFeedDto> GetForCandidateAsync(
        Guid candidateId, decimal minScore, int take, DateTime now, CancellationToken cancellationToken = default);
}

public interface IJobMatchWriter
{
    Task<bool> DismissAsync(Guid candidateId, Guid candidateJobMatchId, DateTime now, CancellationToken cancellationToken = default);
}

public sealed record GetMyJobMatchesQuery(Guid UserId) : IRequest<JobMatchFeedDto>;

public sealed class GetMyJobMatchesQueryHandler : IRequestHandler<GetMyJobMatchesQuery, JobMatchFeedDto>
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

    public async Task<JobMatchFeedDto> Handle(GetMyJobMatchesQuery request, CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên.");
        var minScore = await _settings.GetDecimalAsync(BusinessSettingKeys.JobMatchMinScore, cancellationToken);
        return await _reader.GetForCandidateAsync(candidate.CandidateId, minScore, MaxSuggestions, DateTime.UtcNow, cancellationToken);
    }
}

public sealed record DismissMyJobMatchCommand(Guid UserId, Guid CandidateJobMatchId) : IRequest;

public sealed class DismissMyJobMatchCommandHandler : IRequestHandler<DismissMyJobMatchCommand>
{
    private readonly ICandidateRepository _candidates;
    private readonly IJobMatchWriter _writer;

    public DismissMyJobMatchCommandHandler(ICandidateRepository candidates, IJobMatchWriter writer)
    {
        _candidates = candidates;
        _writer = writer;
    }

    public async Task Handle(DismissMyJobMatchCommand request, CancellationToken cancellationToken)
    {
        var candidate = await _candidates.GetByUserIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng viên.");
        if (!await _writer.DismissAsync(candidate.CandidateId, request.CandidateJobMatchId, DateTime.UtcNow, cancellationToken))
        {
            throw new NotFoundException("Không tìm thấy gợi ý việc làm này.");
        }
    }
}
