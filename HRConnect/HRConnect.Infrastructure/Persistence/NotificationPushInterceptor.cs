using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence;

/// <summary>
/// BE-04 D: every notification added anywhere (through INotificationRepository) is pushed to its user
/// right after it is committed, so the bell updates without polling. Nothing is pushed for a failed save.
/// </summary>
public sealed class NotificationPushInterceptor : SaveChangesInterceptor
{
    private readonly INotificationPublisher _publisher;
    private readonly ILogger<NotificationPushInterceptor> _logger;
    private List<Notification> _pending = [];

    public NotificationPushInterceptor(INotificationPublisher publisher, ILogger<NotificationPushInterceptor> logger)
    {
        _publisher = publisher;
        _logger = logger;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Capture(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        Capture(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        await PublishAsync(cancellationToken);
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        PublishAsync(CancellationToken.None).GetAwaiter().GetResult();
        return base.SavedChanges(eventData, result);
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData)
    {
        _pending = [];
        base.SaveChangesFailed(eventData);
    }

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        _pending = [];
        return base.SaveChangesFailedAsync(eventData, cancellationToken);
    }

    private void Capture(DbContext? context)
    {
        _pending = context?.ChangeTracker.Entries<Notification>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity)
            .ToList() ?? [];
    }

    private async Task PublishAsync(CancellationToken cancellationToken)
    {
        if (_pending.Count == 0)
        {
            return;
        }

        var batch = _pending;
        _pending = [];
        try
        {
            await _publisher.PublishAsync(batch, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Realtime is a convenience: the notification is already saved and the FE still polls.
            _logger.LogWarning(ex, "Không đẩy được {Count} thông báo realtime.", batch.Count);
        }
    }
}

/// <summary>Used where no SignalR hub runs (workers in tests, tools): nothing is pushed.</summary>
public sealed class NoOpNotificationPublisher : INotificationPublisher
{
    public Task PublishAsync(IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
