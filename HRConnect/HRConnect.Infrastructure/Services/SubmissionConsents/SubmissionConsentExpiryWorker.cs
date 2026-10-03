using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Domain.Entities;
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

    private async Task ExpireBatchAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var now = DateTime.UtcNow;
        var expired = await context.SubmissionConsents
            .Include(consent => consent.Submission)
                .ThenInclude(submission => submission.CandidateCv)
            .Include(consent => consent.Submission)
                .ThenInclude(submission => submission.Candidate)
            .Include(consent => consent.Submission)
                .ThenInclude(submission => submission.Job)
            .Where(consent => consent.Status == "PENDING" && consent.ExpiresAt <= now)
            .OrderBy(consent => consent.ExpiresAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        foreach (var consent in expired)
        {
            consent.Status = "EXPIRED";
            consent.UpdatedAt = now;
            consent.ConcurrencyToken = Guid.NewGuid();
            consent.Submission.Status = "CONSENT_EXPIRED";
            consent.Submission.UpdatedAt = now;
            if (consent.Submission.CandidateCv.Status == "PENDING_CONSENT")
            {
                consent.Submission.CandidateCv.Status = "ARCHIVED";
                consent.Submission.CandidateCv.UpdatedAt = now;
            }

            var notificationExists = await context.Notifications.AnyAsync(notification =>
                notification.UserId == consent.Submission.SubmittedBy &&
                notification.NotificationType == SubmissionConsentNotificationFactory.NotificationType &&
                notification.RelatedEntityType == "SUBMISSION" &&
                notification.RelatedEntityId == consent.SubmissionId,
                cancellationToken);
            if (!notificationExists)
            {
                context.Notifications.Add(
                    SubmissionConsentNotificationFactory.CreateAffiliateResult(consent.Submission, "EXPIRED", now));
            }
        }

        if (expired.Count > 0)
        {
            await context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Đã đóng {Count} yêu cầu Candidate consent hết hạn.", expired.Count);
        }
    }
}
