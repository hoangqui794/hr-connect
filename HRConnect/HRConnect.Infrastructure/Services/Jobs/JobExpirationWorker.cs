using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
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

        if (expiredJobIds.Count == 0) return 0;

        var expiredCount = 0;
        foreach (var jobId in expiredJobIds)
        {
            await using var itemScope = _scopeFactory.CreateAsyncScope();
            var context = itemScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notifications = itemScope.ServiceProvider.GetRequiredService<INotificationRepository>();

            var job = await context.Jobs
                .Include(j => j.JobStatusHistories)
                .SingleOrDefaultAsync(j => j.JobId == jobId, cancellationToken);

            if (job == null || job.Status != JobStatuses.Active || job.ExpiresAt == null || job.ExpiresAt.Value > now)
            {
                continue;
            }

            var oldStatus = job.Status;
            job.Status = JobStatuses.Closed;
            job.ClosedAt = now;
            job.StatusReason = "Tin đăng đã hết hạn theo thời hạn gói đăng tin.";
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
                    Message = $"Tin tuyển dụng \"{job.Title}\" đã hết thời hạn hiển thị theo gói (30 ngày) và tự động đóng. Bạn có thể đăng tin mới với Gói Tiêu Chuẩn (STANDARD) để tiếp tục tuyển dụng.",
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

        return expiredCount;
    }
}
