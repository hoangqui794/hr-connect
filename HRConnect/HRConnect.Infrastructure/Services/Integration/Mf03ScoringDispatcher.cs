using System.Net.Http.Json;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HRConnect.Infrastructure.Services.Integration;

public sealed class Mf03ScoringDispatcher : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly Mf03IntegrationSettings _settings;
    private readonly ILogger<Mf03ScoringDispatcher> _logger;

    public Mf03ScoringDispatcher(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        IOptions<Mf03IntegrationSettings> options,
        ILogger<Mf03ScoringDispatcher> logger)
    {
        _scopeFactory = scopeFactory;
        _httpClientFactory = httpClientFactory;
        _settings = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(1, _settings.PollIntervalSeconds)));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "MF-03 dispatcher cycle failed; pending requests will be retried.");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }

    internal async Task DispatchBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var processingTimeout = _settings.ProcessingTimeoutSeconds > 0
            ? TimeSpan.FromSeconds(Math.Max(30, _settings.ProcessingTimeoutSeconds))
            : TimeSpan.FromMinutes(Math.Max(1, _settings.ProcessingTimeoutMinutes));
        var timeoutAt = DateTime.UtcNow.Subtract(processingTimeout);

        var jobs = await db.AiMatchResults
            .Include(result => result.Application)
            .ThenInclude(application => application.Submission)
            .Where(result => result.Status == "PENDING" ||
                (result.Status == "PROCESSING" &&
                    (result.LastDispatchedAt ?? result.ProcessingStartedAt ?? result.RequestedAt) < timeoutAt))
            .OrderBy(result => result.RequestedAt)
            .Take(Math.Clamp(_settings.BatchSize, 1, 100))
            .ToListAsync(cancellationToken);

        var client = _httpClientFactory.CreateClient("Mf03AiService");
        foreach (var job in jobs)
        {
            var application = job.Application;
            var submission = application.Submission;
            if (submission == null)
            {
                var previousStatus = job.Status;
                job.Status = "FAILED";
                job.FailureCode = "ACCEPTED_SUBMISSION_MISSING";
                job.ErrorMessage = "Accepted submission is missing for this application.";
                job.CompletedAt = DateTime.UtcNow;
                db.AuditLogs.Add(CreateSystemAudit(job, "AI_SCORING_FAILED", previousStatus));
                _logger.LogError(
                    "MF-03 request {RequestId} failed because ApplicationId={ApplicationId} has no accepted submission.",
                    job.ExternalReference, job.ApplicationId);
                continue;
            }

            var requestId = job.ExternalReference ?? job.MatchResultId.ToString();
            var payload = new
            {
                requestId,
                applicationId = application.ApplicationId,
                cvId = submission.CvId,
                jobId = application.JobId,
                attemptNo = job.AttemptNo
            };

            var claimedDispatchCount = 0;
            try
            {
                // Persist the claim before enqueueing. A fast MF-03 callback must
                // never be overwritten by a later, tracked PROCESSING update.
                job.Status = "PROCESSING";
                job.ProcessingStartedAt ??= DateTime.UtcNow;
                job.LastDispatchedAt = DateTime.UtcNow;
                job.DispatchCount += 1;
                job.FailureCode = null;
                job.ErrorMessage = null;
                await db.SaveChangesAsync(cancellationToken);
                claimedDispatchCount = job.DispatchCount;

                using var response = await client.PostAsJsonAsync("/api/v1/scoring-jobs", payload, cancellationToken);
                response.EnsureSuccessStatusCode();
                _logger.LogInformation(
                    "Dispatched MF-03 request {RequestId}: ApplicationId={ApplicationId}, CvId={CvId}, JobId={JobId}, AttemptNo={AttemptNo}, DispatchCount={DispatchCount}.",
                    requestId, application.ApplicationId, submission.CvId, application.JobId, job.AttemptNo, job.DispatchCount);
            }
            catch (Exception ex)
            {
                // A timed-out earlier attempt can callback while this request is
                // in flight. Reload first so a late failure cannot turn a valid
                // COMPLETED result back into PENDING.
                await db.Entry(job).ReloadAsync(cancellationToken);
                if (job.Status != "PROCESSING" || job.DispatchCount != claimedDispatchCount)
                {
                    _logger.LogWarning(ex, "MF-03 dispatch {RequestId} failed after its state changed to {Status}; leaving the newer state intact.", requestId, job.Status);
                    continue;
                }
                job.Status = "PENDING";
                job.ErrorMessage = ex.Message.Length <= 2000 ? ex.Message : ex.Message[..2000];
                await db.SaveChangesAsync(cancellationToken);
                _logger.LogWarning(ex, "Could not dispatch MF-03 request {RequestId}; it remains pending.", requestId);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private static AuditLog CreateSystemAudit(AiMatchResult result, string action, string previousStatus)
    {
        Guid? correlationId = Guid.TryParse(result.ExternalReference, out var parsed) ? parsed : null;
        return new AuditLog
        {
            Action = action,
            EntityType = "APPLICATION",
            EntityId = result.ApplicationId,
            OldValues = System.Text.Json.JsonSerializer.Serialize(new { status = previousStatus }),
            NewValues = System.Text.Json.JsonSerializer.Serialize(new
            {
                status = result.Status,
                attemptNo = result.AttemptNo,
                failureCode = result.FailureCode
            }),
            CorrelationId = correlationId,
            CreatedAt = DateTime.UtcNow
        };
    }
}
