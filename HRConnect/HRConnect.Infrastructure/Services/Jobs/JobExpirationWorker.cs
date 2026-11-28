using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Jobs;

/// <summary>
/// Worker định kỳ kiểm tra và tự động đóng các tin tuyển dụng đã hết hạn thời gian hiển thị theo gói (MF-01 B1).
/// </summary>
public sealed class JobExpirationWorker : BackgroundService
{
    public const int PendingAgreementGraceDays = 3;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<JobExpirationWorker> _logger;

    public JobExpirationWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<JobExpirationWorker> logger)
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
                await ExpireJobsBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Đã xảy ra lỗi khi kiểm tra các tin tuyển dụng hết hạn.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }

    internal async Task<int> ExpireJobsBatchAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        List<Guid> expiredJobIds;

        await using (var discoveryScope = _scopeFactory.CreateAsyncScope())
        {
            var discoveryContext = discoveryScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            expiredJobIds = await discoveryContext.Jobs.AsNoTracking()
                .Where(j => j.Status == JobStatuses.Active && j.ExpiresAt != null && j.ExpiresAt.Value <= now)
                .OrderBy(j => j.ExpiresAt)
                .Take(100)
                .Select(j => j.JobId)
                .ToListAsync(cancellationToken);
        }

        var expiredCount = 0;
        foreach (var jobId in expiredJobIds)
        {
            await using var itemScope = _scopeFactory.CreateAsyncScope();
            var context = itemScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notifications = itemScope.ServiceProvider.GetRequiredService<INotificationRepository>();

            var job = await context.Jobs
                .Include(j => j.JobStatusHistories)
                .Include(j => j.PostingPackage)
                .SingleOrDefaultAsync(j => j.JobId == jobId, cancellationToken);

            if (job == null || job.Status != JobStatuses.Active || job.ExpiresAt == null || job.ExpiresAt.Value > now)
            {
                continue;
            }

            var oldStatus = job.Status;
            job.Status = JobStatuses.Closed;
            job.ClosedAt = now;
            job.StatusReason = "Tin đăng đã hết hạn theo thời hạn gói đăng tin.";
            job.StatusReasonCode = JobReasonCodes.ClosedExpired;
            job.StatusChangedAt = now;
            job.UpdatedAt = now;
            job.ConcurrencyToken = Guid.NewGuid();

            var history = new JobStatusHistory
            {
                JobStatusHistoryId = Guid.NewGuid(),
                JobId = job.JobId,
                OldStatus = oldStatus,
                NewStatus = JobStatuses.Closed,
                ChangedBy = null,
                ReasonCode = JobReasonCodes.ClosedExpired,
                ReasonText = "Hết hạn thời gian hiển thị theo gói đăng tin",
                ChangedAt = now
            };

            await context.JobStatusHistories.AddAsync(history, cancellationToken);

            var companyUserIds = await context.CompanyUsers.AsNoTracking()
                .Where(cu => cu.CompanyId == job.CompanyId && cu.Status == "ACTIVE")
                .Select(cu => cu.UserId)
                .ToListAsync(cancellationToken);

            var recipients = companyUserIds.Count > 0 ? companyUserIds.Distinct().ToList() : new List<Guid> { job.CreatedBy };

            foreach (var recipientId in recipients)
            {
                await notifications.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = recipientId,
                    NotificationType = "JOB",
                    Title = "Gói đăng tin đã hết hạn hiển thị",
                    Message = BuildExpirationNotificationMessage(job),
                    RelatedEntityType = "JOB",
                    RelatedEntityId = job.JobId,
                    Metadata = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        jobId = job.JobId,
                        status = JobStatuses.Closed,
                        reason = "EXPIRED",
                        actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
                    }),
                    IsRead = false,
                    CreatedAt = now
                }, cancellationToken);
            }

            await context.SaveChangesAsync(cancellationToken);
            expiredCount++;
        }

        if (expiredCount > 0)
        {
            _logger.LogInformation("Đã tự động đóng {Count} tin tuyển dụng hết hạn hiển thị.", expiredCount);
        }

        expiredCount += await ExpireStalePendingAgreementJobsAsync(now, cancellationToken);

        return expiredCount;
    }

    internal async Task<int> ExpireStalePendingAgreementJobsAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        List<Guid> candidateJobIds;
        await using (var discoveryScope = _scopeFactory.CreateAsyncScope())
        {
            var discoveryContext = discoveryScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var pendingJobs = await discoveryContext.Jobs.AsNoTracking()
                .Where(j => j.Status == JobStatuses.PendingAgreement && j.ApplicationDeadline != null)
                .Select(j => new { j.JobId, j.ApplicationDeadline })
                .ToListAsync(cancellationToken);

            candidateJobIds = pendingJobs
                .Where(j =>
                {
                    var effective = JobDates.GetEffectiveDeadlineUtc(j.ApplicationDeadline);
                    return effective.HasValue && effective.Value.AddDays(PendingAgreementGraceDays) <= nowUtc;
                })
                .Take(100)
                .Select(j => j.JobId)
                .ToList();
        }

        if (candidateJobIds.Count == 0) return 0;

        var closedCount = 0;
        foreach (var jobId in candidateJobIds)
        {
            await using var itemScope = _scopeFactory.CreateAsyncScope();
            var context = itemScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notifications = itemScope.ServiceProvider.GetRequiredService<INotificationRepository>();

            var job = await context.Jobs
                .Include(j => j.JobStatusHistories)
                .SingleOrDefaultAsync(j => j.JobId == jobId, cancellationToken);

            if (job == null || job.Status != JobStatuses.PendingAgreement || job.ApplicationDeadline == null)
            {
                continue;
            }

            var effectiveDeadline = JobDates.GetEffectiveDeadlineUtc(job.ApplicationDeadline);
            if (!effectiveDeadline.HasValue || effectiveDeadline.Value.AddDays(PendingAgreementGraceDays) > nowUtc)
            {
                continue;
            }

            var unsignedAgreements = await context.ServiceAgreements
                .Where(a => a.JobId == job.JobId &&
                            a.Status != ServiceAgreementStatuses.Signed &&
                            a.Status != ServiceAgreementStatuses.Void)
                .ToListAsync(cancellationToken);

            // Never auto-void or auto-close a job whose Client has already signed/uploaded a signed agreement copy.
            if (unsignedAgreements.Any(a => !string.IsNullOrWhiteSpace(a.SignedDocumentStorageKey)))
            {
                continue;
            }

            foreach (var agreement in unsignedAgreements)
            {
                agreement.Status = ServiceAgreementStatuses.Void;
                agreement.IsCurrent = false;
                agreement.VoidedAt = nowUtc;
                agreement.VoidReason = $"Tin tuyển dụng chưa ký thỏa thuận đã quá hạn nhận hồ sơ quá {PendingAgreementGraceDays} ngày nên hệ thống tự động hủy dự thảo.";
                agreement.ConcurrencyToken = Guid.NewGuid();
            }

            var oldStatus = job.Status;
            job.CurrentServiceAgreementId = null;
            job.Status = JobStatuses.Closed;
            job.ClosedAt = nowUtc;
            job.StatusReason = $"Tin tuyển dụng chưa ký thỏa thuận đã quá hạn nhận hồ sơ quá {PendingAgreementGraceDays} ngày nên hệ thống tự động hủy dự thảo và đóng tin.";
            job.StatusReasonCode = JobReasonCodes.ClosedExpired;
            job.StatusChangedAt = nowUtc;
            job.UpdatedAt = nowUtc;
            job.ConcurrencyToken = Guid.NewGuid();

            await context.JobStatusHistories.AddAsync(new JobStatusHistory
            {
                JobStatusHistoryId = Guid.NewGuid(),
                JobId = job.JobId,
                OldStatus = oldStatus,
                NewStatus = JobStatuses.Closed,
                ChangedBy = null,
                ReasonCode = JobReasonCodes.ClosedExpired,
                ReasonText = $"Tự động hủy dự thảo thỏa thuận và đóng tin do quá hạn nhận hồ sơ quá {PendingAgreementGraceDays} ngày",
                ChangedAt = nowUtc
            }, cancellationToken);

            var companyUserIds = await context.CompanyUsers.AsNoTracking()
                .Where(cu => cu.CompanyId == job.CompanyId && cu.Status == "ACTIVE")
                .Select(cu => cu.UserId)
                .ToListAsync(cancellationToken);
            var companyRecipients = companyUserIds.Count > 0 ? companyUserIds.Distinct().ToList() : new List<Guid> { job.CreatedBy };

            foreach (var recipientId in companyRecipients)
            {
                await notifications.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = recipientId,
                    NotificationType = "JOB",
                    Title = "Tin chờ ký thỏa thuận đã tự động đóng do quá hạn",
                    Message = $"Tin tuyển dụng \"{job.Title}\" chưa ký thỏa thuận đã quá hạn nhận hồ sơ quá {PendingAgreementGraceDays} ngày. Hệ thống đã tự động hủy dự thảo thỏa thuận và đóng tin.",
                    RelatedEntityType = "JOB",
                    RelatedEntityId = job.JobId,
                    Metadata = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        jobId = job.JobId,
                        status = JobStatuses.Closed,
                        reason = "EXPIRED_PENDING_AGREEMENT",
                        actionRoute = $"/client/jobs?highlight={job.JobId}&openDetail=true"
                    }),
                    IsRead = false,
                    CreatedAt = nowUtc
                }, cancellationToken);
            }

            var hrUserIds = await context.UserRoles.AsNoTracking()
                .Where(ur => ur.Status == "ACTIVE" && ur.Role.IsActive && ur.Role.Code == "INTERNAL_HR" && ur.User.Status == "ACTIVE")
                .Select(ur => ur.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var hrId in hrUserIds)
            {
                await notifications.AddAsync(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    UserId = hrId,
                    NotificationType = "JOB",
                    Title = "Tự động đóng tin chờ ký thỏa thuận quá hạn",
                    Message = $"Tin \"{job.Title}\" quá hạn nộp hồ sơ quá {PendingAgreementGraceDays} ngày khi chưa ký thỏa thuận nên hệ thống đã tự động hủy dự thảo và đóng tin.",
                    RelatedEntityType = "JOB",
                    RelatedEntityId = job.JobId,
                    Metadata = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        jobId = job.JobId,
                        status = JobStatuses.Closed,
                        reason = "EXPIRED_PENDING_AGREEMENT",
                        routeHint = $"/hr/jobs?highlight={job.JobId}"
                    }),
                    IsRead = false,
                    CreatedAt = nowUtc
                }, cancellationToken);
            }

            await context.SaveChangesAsync(cancellationToken);
            closedCount++;
        }

        if (closedCount > 0)
        {
            _logger.LogInformation("Đã tự động hủy dự thảo và đóng {Count} tin chờ ký thỏa thuận quá hạn nộp quá {Days} ngày.", closedCount, PendingAgreementGraceDays);
        }

        return closedCount;
    }

    internal static string BuildExpirationNotificationMessage(Job job)
    {
        var durationText = job.PostingPackage is { DurationDays: > 0 } pkg
            ? $" ({pkg.DurationDays} ngày)"
            : string.Empty;
        var isFreePackage = string.Equals(
            job.PostingPackage?.Code,
            JobPostingPackageCodes.Free,
            StringComparison.OrdinalIgnoreCase);

        return isFreePackage
            ? $"Tin tuyển dụng \"{job.Title}\" đã hết thời hạn hiển thị theo gói{durationText} và tự động đóng. Bạn có thể đăng tin mới với Gói Tiêu Chuẩn (STANDARD) để tiếp tục tuyển dụng."
            : $"Tin tuyển dụng \"{job.Title}\" đã hết thời hạn hiển thị theo gói{durationText} và tự động đóng. Bạn có thể đăng tin mới để tiếp tục tuyển dụng.";
    }
}
