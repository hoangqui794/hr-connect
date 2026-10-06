using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.SubmissionConsents;

public sealed class SubmissionConsentExpiryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SubmissionConsentExpiryWorker> _logger;

    public SubmissionConsentExpiryWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<SubmissionConsentExpiryWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ExpireBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Không thể cập nhật các yêu cầu Candidate consent hết hạn.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }

    internal async Task ExpireBatchAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        List<Guid> expiredIds;
        await using (var discoveryScope = _scopeFactory.CreateAsyncScope())
        {
            var discoveryContext = discoveryScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            expiredIds = await discoveryContext.SubmissionConsents.AsNoTracking()
                .Where(consent => consent.Status == "PENDING" && consent.ExpiresAt <= now)
                .OrderBy(consent => consent.ExpiresAt)
                .Take(100)
                .Select(consent => consent.ConsentId)
                .ToListAsync(cancellationToken);
        }

        var expiredCount = 0;
        foreach (var consentId in expiredIds)
        {
            await using var itemScope = _scopeFactory.CreateAsyncScope();
            var context = itemScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var expiryService = itemScope.ServiceProvider.GetRequiredService<ISubmissionConsentExpiryService>();
            var consent = await context.SubmissionConsents
                .Include(item => item.Submission).ThenInclude(submission => submission.CandidateCv)
                .Include(item => item.Submission).ThenInclude(submission => submission.Candidate)
                .Include(item => item.Submission).ThenInclude(submission => submission.Job)
                .SingleOrDefaultAsync(item => item.ConsentId == consentId, cancellationToken);
            if (consent == null || consent.Status != "PENDING" || consent.ExpiresAt > now)
                continue;

            try
            {
                if (await expiryService.ExpireAsync(
                        consent, now, null, "BACKGROUND_WORKER", cancellationToken))
                {
                    expiredCount++;
                }
            }
            catch (ConflictException exception) when (exception.ErrorCode == "CONCURRENT_UPDATE")
            {
                _logger.LogInformation(
                    "Bỏ qua consent {ConsentId} vì trạng thái vừa được cập nhật bởi yêu cầu khác.",
                    consentId);
            }
        }

        if (expiredCount > 0)
        {
            _logger.LogInformation("Đã đóng {Count} yêu cầu Candidate consent hết hạn.", expiredCount);
        }
    }
}
