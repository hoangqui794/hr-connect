using System.Net.Http.Json;
using HRConnect.Application.Common.Models;
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
        var timeoutAt = DateTime.UtcNow.AddMinutes(-Math.Max(1, _settings.ProcessingTimeoutMinutes));

        var jobs = await db.AiMatchResults
            .Include(result => result.Application)
                .ThenInclude(application => application.Submission)
            .Where(result => result.Status == "PENDING" ||
                (result.Status == "PROCESSING" && result.RequestedAt < timeoutAt))
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
                job.Status = "FAILED";
                job.ErrorMessage = "Accepted submission is missing for this application.";
                job.CompletedAt = DateTime.UtcNow;
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

            try
            {
                using var response = await client.PostAsJsonAsync("/api/v1/scoring-jobs", payload, cancellationToken);
                response.EnsureSuccessStatusCode();
                job.Status = "PROCESSING";
                job.ErrorMessage = null;
                job.RequestedAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                job.Status = "PENDING";
                job.ErrorMessage = ex.Message.Length <= 2000 ? ex.Message : ex.Message[..2000];
                _logger.LogWarning(ex, "Could not dispatch MF-03 request {RequestId}; it remains pending.", requestId);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
