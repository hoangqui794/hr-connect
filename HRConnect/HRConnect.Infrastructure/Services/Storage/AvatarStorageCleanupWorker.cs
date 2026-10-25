using HRConnect.Application.Common.Interfaces;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Services.Storage;

public sealed class AvatarStorageCleanupWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<AvatarStorageCleanupWorker> logger) : BackgroundService
{
    internal const int MaxAttempts = 8;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessBatchAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
            await ProcessBatchAsync(stoppingToken);
    }

    internal async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        await using var scope = scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ids = await context.StorageCleanupJobs.AsNoTracking()
            .Where(job => job.AttemptCount < MaxAttempts &&
                          ((job.Status == "PENDING" || job.Status == "FAILED") &&
                           (job.NextAttemptAt == null || job.NextAttemptAt <= now) ||
                           job.Status == "PROCESSING" && job.ProcessingStartedAt <= now.AddMinutes(-15)))
            .OrderBy(job => job.CreatedAt)
            .Take(50)
            .Select(job => job.StorageCleanupJobId)
            .ToListAsync(cancellationToken);

        foreach (var id in ids)
            await ProcessOneAsync(id, cancellationToken);
    }

    private async Task ProcessOneAsync(Guid id, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        await using var scope = scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<IFileStorageService>();
        var claimed = await context.StorageCleanupJobs
            .Where(job => job.StorageCleanupJobId == id && job.AttemptCount < MaxAttempts &&
                          ((job.Status == "PENDING" || job.Status == "FAILED") &&
                           (job.NextAttemptAt == null || job.NextAttemptAt <= now) ||
                           job.Status == "PROCESSING" && job.ProcessingStartedAt <= now.AddMinutes(-15)))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(job => job.Status, "PROCESSING")
                .SetProperty(job => job.ProcessingStartedAt, now)
                .SetProperty(job => job.UpdatedAt, now)
                .SetProperty(job => job.LastError, (string?)null), cancellationToken);
        if (claimed != 1) return;

        var job = await context.StorageCleanupJobs.SingleAsync(item => item.StorageCleanupJobId == id, cancellationToken);
        try
        {
            if (!IsOwnedImageKey(job.ObjectKey))
                throw new InvalidOperationException("Cleanup key is outside an owned image namespace.");
            var stillReferenced = job.ObjectKey.StartsWith("avatars/", StringComparison.Ordinal)
                ? await context.AppUsers.AsNoTracking().AnyAsync(user =>
                    user.AvatarObjectKey == job.ObjectKey || user.AvatarUrl == job.ObjectKey, cancellationToken)
                : await context.Companies.AsNoTracking().AnyAsync(company =>
                    company.LogoObjectKey == job.ObjectKey || company.LogoUrl == job.ObjectKey, cancellationToken);
            if (stillReferenced)
                throw new InvalidOperationException("Cleanup key is still referenced by an active image.");

            await storage.DeleteAsync(job.ObjectKey, cancellationToken);
            job.Status = "COMPLETED";
            job.CompletedAt = DateTime.UtcNow;
            job.ProcessingStartedAt = null;
            job.NextAttemptAt = null;
            job.LastError = null;
            job.UpdatedAt = job.CompletedAt.Value;
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            job.AttemptCount += 1;
            job.Status = job.AttemptCount >= MaxAttempts ? "DEAD" : "FAILED";
            job.LastError = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;
            job.ProcessingStartedAt = null;
            job.NextAttemptAt = job.Status == "DEAD" ? null : DateTime.UtcNow.Add(CalculateRetryDelay(job.AttemptCount));
            job.UpdatedAt = DateTime.UtcNow;
            await context.SaveChangesAsync(CancellationToken.None);
            logger.LogWarning(ex, "Image cleanup job {CleanupJobId} failed at attempt {Attempt}/{MaxAttempts}",
                job.StorageCleanupJobId, job.AttemptCount, MaxAttempts);
        }
    }

    internal static bool IsAvatarKey(string? key) =>
        !string.IsNullOrWhiteSpace(key) && key.StartsWith("avatars/", StringComparison.Ordinal) && !key.Contains("..", StringComparison.Ordinal);

    internal static bool IsOwnedImageKey(string? key) =>
        IsAvatarKey(key) || (!string.IsNullOrWhiteSpace(key) &&
            key.StartsWith("company-logos/", StringComparison.Ordinal) && !key.Contains("..", StringComparison.Ordinal));

    internal static TimeSpan CalculateRetryDelay(int attempt) =>
        TimeSpan.FromMinutes(Math.Min(60, Math.Pow(2, Math.Clamp(attempt, 1, MaxAttempts))));
}
