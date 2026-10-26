using System.Net.Http.Json;
using System.Text.Json;
using HRConnect.Application.Common.Interfaces;
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

/// <summary>Calls the existing AI v2 semantic-match endpoint without changing that service.</summary>
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
/// BE-04 C: one matching cycle. For recent ACTIVE jobs that candidates may view, scores eligible candidates
/// (primary ACTIVE CV, not applied) and notifies the good matches, capped per day.
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
        var tiers = await _db.MatchTierConfigs.AsNoTracking().Where(t => t.IsActive).OrderBy(t => t.DisplayOrder).ToListAsync(cancellationToken);

        var candidateViewable = _db.ServiceTypeAllowedRoles.AsNoTracking()
            .Where(m => m.CanView && m.Role.IsActive && m.Role.Code == JobAccessPolicy.CandidateRole)
            .Select(m => m.ServiceTypeId);

        var jobs = await _db.Jobs.AsNoTracking()
            .Include(j => j.JobSkills).ThenInclude(s => s.Skill)
            .Where(j => j.Status == JobStatuses.Active
                        && (j.ApplicationDeadline == null || j.ApplicationDeadline > now)
                        && candidateViewable.Contains(j.ServiceTypeId))
            .OrderByDescending(j => j.PostedAt ?? j.CreatedAt)
            .Take(Math.Max(1, jobsPerCycle))
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

        var sentToday = new Dictionary<Guid, int>();
        var saved = 0;
        foreach (var job in jobs)
        {
            var targetCount = Math.Clamp(candidatesPerJob, 1, 50);
            var pageSize = Math.Max(50, targetCount * 2);
            var offset = 0;
            var pending = new List<PendingPair>(targetCount);
            while (pending.Count < targetCount)
            {
                var candidates = await _db.Candidates.AsNoTracking()
                    .Include(c => c.CandidateSkills).ThenInclude(s => s.Skill)
                    .Include(c => c.CandidateCvs)
                    .Where(c => c.UserId != null && c.Status == "ACTIVE"
                                && c.CandidateCvs.Any(cv => cv.IsPrimary && cv.Status == "ACTIVE")
                                && !_db.Applications.Any(a => a.JobId == job.JobId && a.CandidateId == c.CandidateId))
                    .OrderBy(c => c.CandidateId)
                    .Skip(offset)
                    .Take(pageSize)
                    .AsSplitQuery()
                    .ToListAsync(cancellationToken);
                if (candidates.Count == 0) break;
                offset += candidates.Count;

                var candidateIds = candidates.Select(c => c.CandidateId).ToList();
                var existingRows = await _db.CandidateJobMatches
                    .Where(m => m.JobId == job.JobId && candidateIds.Contains(m.CandidateId))
                    .OrderByDescending(m => m.AttemptNo)
                    .ThenByDescending(m => m.GeneratedAt)
                    .ToListAsync(cancellationToken);

                foreach (var candidate in candidates)
                {
                    var cv = candidate.CandidateCvs
                        .Where(c => c.IsPrimary && c.Status == "ACTIVE")
                        .OrderByDescending(c => c.UpdatedAt)
                        .First();
                    var fingerprint = HybridJobMatchScorer.BuildFingerprint(candidate, cv, job);
                    var rows = existingRows.Where(m => m.CandidateId == candidate.CandidateId).ToList();
                    var sameInput = rows.FirstOrDefault(m => m.InputFingerprint == fingerprint);

                    if (sameInput?.Status == JobMatchStates.Dismissed) continue;
                    if (sameInput?.Status == JobMatchStates.Generated && (sameInput.ExpiresAt == null || sameInput.ExpiresAt > now)) continue;
                    if (sameInput?.Status == JobMatchStates.Failed &&
                        (sameInput.RetryCount >= 3 || (sameInput.NextRetryAt.HasValue && sameInput.NextRetryAt > now))) continue;

                    pending.Add(new PendingPair(candidate, cv, fingerprint, sameInput, rows.Select(r => r.AttemptNo).DefaultIfEmpty(0).Max()));
                    if (pending.Count == targetCount) break;
                }

                if (candidates.Count < pageSize) break;
            }
            if (pending.Count == 0) continue;

            var scores = (await _ai.ScoreAsync(job.JobId, pending.Select(p => p.Cv.CvId).ToList(), cancellationToken))
                .GroupBy(s => s.CvId)
                .ToDictionary(g => g.Key, g => g.Last());
            var savedForJob = 0;
            foreach (var pair in pending)
            {
                if (!scores.TryGetValue(pair.Cv.CvId, out var semantic)) continue;
                var ok = semantic.Score.HasValue && semantic.Error == null;
                var row = pair.SameInput ?? new CandidateJobMatch
                {
                    CandidateJobMatchId = Guid.NewGuid(),
                    CandidateId = pair.Candidate.CandidateId,
                    JobId = job.JobId,
                    CvId = pair.Cv.CvId,
                    AttemptNo = pair.MaxAttempt + 1,
                    RetryCount = 0,
                    InputFingerprint = pair.Fingerprint,
                    ScoringVersion = HybridJobMatchScorer.Version,
                    CreatedAt = now
                };

                row.RetryCount++;
                row.LastAttemptAt = now;
                row.GeneratedAt = now;
                row.ExpiresAt = now.AddDays(expiryDays);

                HybridJobMatchResult? hybrid = null;
                if (ok)
                {
                    hybrid = HybridJobMatchScorer.Evaluate(pair.Candidate, job, semantic.Score!.Value, tiers, now);
                    row.MatchScore = hybrid.Score;
                    row.MatchTier = hybrid.TierCode;
                    row.MatchingReasons = JsonSerializer.Serialize(hybrid.MatchingReasons);
                    row.MissingRequirements = JsonSerializer.Serialize(hybrid.MissingRequirements);
                    row.MatchSummary = JsonSerializer.Serialize(new { scoringVersion = HybridJobMatchScorer.Version, components = hybrid.Components });
                    row.Status = JobMatchStates.Generated;
                    row.NextRetryAt = null;
                }
                else
                {
                    row.MatchScore = null;
                    row.MatchTier = null;
                    row.MatchingReasons = null;
                    row.MissingRequirements = null;
                    row.MatchSummary = JsonSerializer.Serialize(new { error = semantic.Error ?? "SEMANTIC_SCORE_UNAVAILABLE" });
                    row.Status = JobMatchStates.Failed;
                    row.NextRetryAt = row.RetryCount >= 3 ? null : now.AddMinutes(15 * Math.Pow(2, Math.Max(0, row.RetryCount - 1)));
                }

                if (pair.SameInput == null) _db.CandidateJobMatches.Add(row);
                savedForJob++;

                if (!ok || hybrid!.Score < minScore) continue;
                var userId = pair.Candidate.UserId!.Value;
                if (!sentToday.TryGetValue(userId, out var count))
                {
                    count = await _db.Notifications.CountAsync(
                        n => n.UserId == userId && n.NotificationType == "JOB_FIT" && n.CreatedAt >= now.Date, cancellationToken);
                }
                if (count >= maxPerDay) continue;
                sentToday[userId] = count + 1;
                _db.Notifications.Add(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = userId,
                    NotificationType = "JOB_FIT",
                    Title = "Có việc làm phù hợp với bạn",
                    Message = $"Tin \"{job.Title}\" được đánh giá {Math.Round(hybrid.Score)}% phù hợp với CV và mong muốn nghề nghiệp của bạn.",
                    RelatedEntityType = "JOB",
                    RelatedEntityId = job.JobId,
                    Metadata = JsonSerializer.Serialize(new { jobId = job.JobId, score = hybrid.Score, routeHint = $"/candidate/jobs/{job.JobId}" }),
                    CreatedAt = now,
                });
            }

            try
            {
                await _db.SaveChangesAsync(cancellationToken); // per job, so one failing job does not lose the others
                saved += savedForJob;
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "Job match rows for job {JobId} conflicted with another worker; the next cycle will reconcile them.", job.JobId);
                _db.ChangeTracker.Clear();
            }
        }

        if (saved > 0) _logger.LogInformation("Job match cycle saved {Count} match(es) for {Jobs} job(s).", saved, jobs.Count);
        return saved;
    }

    private sealed record PendingPair(Candidate Candidate, CandidateCv Cv, string Fingerprint, CandidateJobMatch? SameInput, int MaxAttempt);
}

public sealed class JobMatchReader : IJobMatchReader
{
    private readonly ApplicationDbContext _db;
    private readonly ICompanyLogoUrlResolver? _logoUrlResolver;

    public JobMatchReader(ApplicationDbContext db, ICompanyLogoUrlResolver? logoUrlResolver = null)
    {
        _db = db;
        _logoUrlResolver = logoUrlResolver;
    }

    public async Task<JobMatchFeedDto> GetForCandidateAsync(
        Guid candidateId, decimal minScore, int take, DateTime now, CancellationToken cancellationToken = default)
    {
        var rows = await _db.CandidateJobMatches.AsNoTracking()
            .Include(m => m.Job).ThenInclude(j => j.Company)
            .Include(m => m.MatchTierNavigation)
            .Where(m => m.CandidateId == candidateId
                        && m.Status == JobMatchStates.Generated
                        && m.MatchScore >= minScore
                        && (m.ExpiresAt == null || m.ExpiresAt > now)
                        && m.Job.Status == JobStatuses.Active
                        && (m.Job.ApplicationDeadline == null || m.Job.ApplicationDeadline > now)
                        && !_db.Applications.Any(a => a.JobId == m.JobId && a.CandidateId == candidateId)
                        && !_db.CandidateJobMatches.Any(newer => newer.CandidateId == candidateId
                            && newer.JobId == m.JobId
                            && (newer.AttemptNo > m.AttemptNo
                                || (newer.AttemptNo == m.AttemptNo && newer.GeneratedAt > m.GeneratedAt))))
            .OrderByDescending(m => m.MatchScore)
            .ThenByDescending(m => m.GeneratedAt)
            .Take(Math.Clamp(take, 1, 20))
            .ToListAsync(cancellationToken);

        var items = rows.Select(m => new JobMatchDto(
            m.CandidateJobMatchId,
            m.JobId,
            m.Job.Title,
            m.Job.Company.CompanyName,
            _logoUrlResolver?.Resolve(m.Job.Company) ?? m.Job.Company.LogoUrl,
            m.Job.Location,
            m.Job.EmploymentType,
            m.Job.SalaryMin,
            m.Job.SalaryMax,
            m.Job.SalaryNegotiable,
            m.Job.CurrencyCode,
            m.MatchScore!.Value,
            m.MatchTier,
            m.MatchTierNavigation?.DisplayName,
            ReadStringList(m.MatchingReasons),
            ReadStringList(m.MissingRequirements),
            m.GeneratedAt,
            m.Job.ApplicationDeadline,
            m.ExpiresAt)).ToList();

        var hasPrimaryCv = await _db.CandidateCvs.AsNoTracking()
            .AnyAsync(cv => cv.CandidateId == candidateId && cv.IsPrimary && cv.Status == "ACTIVE", cancellationToken);
        var lastGeneratedAt = await _db.CandidateJobMatches.AsNoTracking()
            .Where(m => m.CandidateId == candidateId)
            .MaxAsync(m => (DateTime?)m.GeneratedAt, cancellationToken);

        return new JobMatchFeedDto(items, new JobMatchFeedMeta(hasPrimaryCv, lastGeneratedAt, HybridJobMatchScorer.Version));
    }

    private static IReadOnlyList<string> ReadStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}

public sealed class JobMatchWriter : IJobMatchWriter
{
    private readonly ApplicationDbContext _db;

    public JobMatchWriter(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<bool> DismissAsync(Guid candidateId, Guid candidateJobMatchId, DateTime now, CancellationToken cancellationToken = default)
    {
        var match = await _db.CandidateJobMatches.FirstOrDefaultAsync(
            m => m.CandidateJobMatchId == candidateJobMatchId && m.CandidateId == candidateId,
            cancellationToken);
        if (match == null) return false;
        if (match.Status == JobMatchStates.Dismissed) return true;

        match.Status = JobMatchStates.Dismissed;
        match.DismissedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }
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
