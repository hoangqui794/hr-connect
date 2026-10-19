using System.Net.Http.Json;
using System.Text.Json;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Candidates.JobMatches;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.JobMatching;

/// <summary>Calls the AI service semantic-match endpoint (same base URL and service token as MF-03 scoring).</summary>
public sealed class JobMatchAiClient : IJobMatchAiClient
{
    public const string HttpClientName = "JobMatchAi";
    private readonly IHttpClientFactory _httpClientFactory;

    public JobMatchAiClient(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    public async Task<IReadOnlyList<JobMatchScore>> ScoreAsync(Guid jobId, IReadOnlyList<Guid> cvIds, CancellationToken cancellationToken = default)
    {
        var client = _httpClientFactory.CreateClient(HttpClientName);
        using var response = await client.PostAsJsonAsync("/api/v1/semantic-match", new { jobId, cvIds }, cancellationToken);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<SemanticMatchResponse>(cancellationToken: cancellationToken);
        return body?.Results?.Select(r => new JobMatchScore(r.CvId, r.Score, r.Error)).ToList() ?? [];
    }

    private sealed record SemanticMatchResponse(List<SemanticMatchItem>? Results);

    private sealed record SemanticMatchItem(Guid CvId, decimal? Score, string? Error);
}

/// <summary>
/// BE-04 C: one matching cycle. For recent ACTIVE jobs that candidates may view, scores public candidates
/// (primary ACTIVE CV, not applied, not matched yet) and notifies the good matches, capped per day.
/// </summary>
public sealed class JobMatchRunner
{
    private readonly ApplicationDbContext _db;
    private readonly IJobMatchAiClient _ai;
    private readonly IAdminBusinessSettings _settings;
    private readonly ILogger<JobMatchRunner> _logger;

    public JobMatchRunner(ApplicationDbContext db, IJobMatchAiClient ai, IAdminBusinessSettings settings, ILogger<JobMatchRunner> logger)
    {
        _db = db;
        _ai = ai;
        _settings = settings;
        _logger = logger;
    }

    public async Task<int> RunOnceAsync(int jobsPerCycle, int candidatesPerJob, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var minScore = await _settings.GetDecimalAsync(BusinessSettingKeys.JobMatchMinScore, cancellationToken);
        var maxPerDay = await _settings.GetIntAsync(BusinessSettingKeys.JobMatchMaxNotificationsPerDay, cancellationToken);
        var expiryDays = await _settings.GetIntAsync(BusinessSettingKeys.JobMatchExpiryDays, cancellationToken);

        var candidateViewable = _db.ServiceTypeAllowedRoles.AsNoTracking()
            .Where(m => m.CanView && m.Role.IsActive && m.Role.Code == JobAccessPolicy.CandidateRole)
            .Select(m => m.ServiceTypeId);
        var publicCandidates = _db.Candidates.AsNoTracking().Where(c => c.ProfileVisibility == "PUBLIC" && c.UserId != null);

        // Jobs that still have unscored public candidates, newest first.
        var jobs = await _db.Jobs.AsNoTracking()
            .Where(j => j.Status == JobStatuses.Active
                        && (j.ApplicationDeadline == null || j.ApplicationDeadline > now)
                        && candidateViewable.Contains(j.ServiceTypeId)
                        && publicCandidates.Any(c =>
                            !_db.CandidateJobMatches.Any(m => m.JobId == j.JobId && m.CandidateId == c.CandidateId)
                            && !_db.Applications.Any(a => a.JobId == j.JobId && a.CandidateId == c.CandidateId)
                            && _db.CandidateCvs.Any(cv => cv.CandidateId == c.CandidateId && cv.IsPrimary && cv.Status == "ACTIVE")))
            .OrderByDescending(j => j.PostedAt ?? j.CreatedAt)
            .Select(j => new { j.JobId, j.Title })
            .Take(Math.Max(1, jobsPerCycle))
            .ToListAsync(cancellationToken);

        var sentToday = new Dictionary<Guid, int>();
        var saved = 0;
        foreach (var job in jobs)
        {
            var pairs = await publicCandidates
                .Where(c => !_db.CandidateJobMatches.Any(m => m.JobId == job.JobId && m.CandidateId == c.CandidateId)
                            && !_db.Applications.Any(a => a.JobId == job.JobId && a.CandidateId == c.CandidateId))
                .SelectMany(c => _db.CandidateCvs.Where(cv => cv.CandidateId == c.CandidateId && cv.IsPrimary && cv.Status == "ACTIVE"),
                    (c, cv) => new { c.CandidateId, UserId = c.UserId!.Value, cv.CvId })
                .OrderBy(p => p.CandidateId)
                .Take(Math.Clamp(candidatesPerJob, 1, 50))
                .ToListAsync(cancellationToken);
            if (pairs.Count == 0) continue;

            var scores = (await _ai.ScoreAsync(job.JobId, pairs.Select(p => p.CvId).ToList(), cancellationToken))
                .ToDictionary(s => s.CvId);
            foreach (var pair in pairs)
            {
                if (!scores.TryGetValue(pair.CvId, out var score)) continue; // not answered: try again next cycle
                var ok = score.Score.HasValue && score.Error == null;
                _db.CandidateJobMatches.Add(new CandidateJobMatch
                {
                    CandidateJobMatchId = Guid.NewGuid(),
                    CandidateId = pair.CandidateId,
                    JobId = job.JobId,
                    CvId = pair.CvId,
                    AttemptNo = 1,
                    MatchScore = ok ? Math.Clamp(score.Score!.Value, 0m, 100m) : null,
                    MatchSummary = ok ? null : score.Error,
                    Status = ok ? JobMatchStates.Generated : JobMatchStates.Failed,
                    GeneratedAt = now,
                    ExpiresAt = now.AddDays(expiryDays),
                    CreatedAt = now,
                });
                saved++;

                if (!ok || score.Score!.Value < minScore) continue;
                if (!sentToday.TryGetValue(pair.UserId, out var count))
                {
                    count = await _db.Notifications.CountAsync(
                        n => n.UserId == pair.UserId && n.NotificationType == "JOB_FIT" && n.CreatedAt >= now.Date, cancellationToken);
                }
                if (count >= maxPerDay) continue;
                sentToday[pair.UserId] = count + 1;
                _db.Notifications.Add(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = pair.UserId,
                    NotificationType = "JOB_FIT",
                    Title = "Có việc làm phù hợp với CV của bạn",
                    Message = $"Tin \"{job.Title}\" khớp {Math.Round(score.Score!.Value)}% với CV chính của bạn.",
                    RelatedEntityType = "JOB",
                    RelatedEntityId = job.JobId,
                    Metadata = JsonSerializer.Serialize(new { jobId = job.JobId, score = score.Score, routeHint = $"/jobs/{job.JobId}" }),
                    CreatedAt = now,
                });
            }

            await _db.SaveChangesAsync(cancellationToken); // per job, so one failing job does not lose the others
        }

        if (saved > 0) _logger.LogInformation("Job match cycle saved {Count} match(es) for {Jobs} job(s).", saved, jobs.Count);
        return saved;
    }
}

public sealed class JobMatchReader : IJobMatchReader
{
    private readonly ApplicationDbContext _db;

    public JobMatchReader(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<JobMatchDto>> GetForCandidateAsync(
        Guid candidateId, decimal minScore, int take, DateTime now, CancellationToken cancellationToken = default) =>
        await _db.CandidateJobMatches.AsNoTracking()
            .Where(m => m.CandidateId == candidateId && m.Status == JobMatchStates.Generated
                        && m.MatchScore >= minScore && (m.ExpiresAt == null || m.ExpiresAt > now)
                        && m.Job.Status == JobStatuses.Active
                        && !_db.Applications.Any(a => a.JobId == m.JobId && a.CandidateId == candidateId))
            .OrderByDescending(m => m.MatchScore).ThenByDescending(m => m.GeneratedAt)
            .Take(take)
            .Select(m => new JobMatchDto(m.CandidateJobMatchId, m.JobId, m.Job.Title, m.Job.Company.CompanyName,
                m.Job.Location, m.MatchScore!.Value, m.GeneratedAt, m.ExpiresAt))
            .ToListAsync(cancellationToken);
}

/// <summary>Runs <see cref="JobMatchRunner"/> on an interval. Config JobMatch:Enabled / IntervalMinutes / JobsPerCycle / CandidatesPerJob.</summary>
public sealed class JobMatchWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<JobMatchWorker> _logger;

    public JobMatchWorker(IServiceScopeFactory scopeFactory, IConfiguration configuration, ILogger<JobMatchWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_configuration.GetValue("JobMatch:Enabled", true)) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, _configuration.GetValue("JobMatch:IntervalMinutes", 60))));
        do
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<JobMatchRunner>().RunOnceAsync(
                    _configuration.GetValue("JobMatch:JobsPerCycle", 5),
                    _configuration.GetValue("JobMatch:CandidatesPerJob", 30),
                    stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Job match cycle failed; it will run again next interval.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
