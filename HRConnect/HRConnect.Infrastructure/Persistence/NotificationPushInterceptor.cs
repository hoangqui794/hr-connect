using System.Data.Common;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Persistence;

/// <summary>
/// BE-04 D: every notification added anywhere (through INotificationRepository) is pushed to its user
/// right after it is committed, so the bell updates without polling. Nothing is pushed for a failed save.
/// REALTIME-01 (test 20/10): a save inside an explicit transaction (dispute resolve, MF-04/05 handlers) is not
/// committed yet, so the publisher's unread count missed it and the bell was overwritten with the old number.
/// Those notifications now wait for the commit and are dropped on rollback.
/// </summary>
public sealed class NotificationPushInterceptor : SaveChangesInterceptor, IDbTransactionInterceptor
{
    private readonly INotificationPublisher _publisher;
    private readonly ILogger<NotificationPushInterceptor> _logger;
    private List<Notification> _pending = [];
    private List<Notification> _awaitingCommit = [];

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
        if (!DeferIfInTransaction(eventData.Context))
        {
            await PublishAsync(TakePending(), cancellationToken);
        }
        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        if (!DeferIfInTransaction(eventData.Context))
        {
            PublishAsync(TakePending(), CancellationToken.None).GetAwaiter().GetResult();
        }
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

    public Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default) =>
        PublishAsync(TakeAwaitingCommit(), cancellationToken);

    public void TransactionCommitted(DbTransaction transaction, TransactionEndEventData eventData) =>
        PublishAsync(TakeAwaitingCommit(), CancellationToken.None).GetAwaiter().GetResult();

    public Task TransactionRolledBackAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        _awaitingCommit = [];
        return Task.CompletedTask;
    }

    public void TransactionRolledBack(DbTransaction transaction, TransactionEndEventData eventData) => _awaitingCommit = [];

    public Task TransactionFailedAsync(DbTransaction transaction, TransactionErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        _awaitingCommit = [];
        return Task.CompletedTask;
    }

    public void TransactionFailed(DbTransaction transaction, TransactionErrorEventData eventData) => _awaitingCommit = [];

    private void Capture(DbContext? context)
    {
        _pending = context?.ChangeTracker.Entries<Notification>()
            .Where(e => e.State == EntityState.Added)
            .Select(e => e.Entity)
            .ToList() ?? [];
    }

    private bool DeferIfInTransaction(DbContext? context)
    {
        if (context?.Database.CurrentTransaction == null)
        {
            return false;
        }
        _awaitingCommit.AddRange(TakePending());
        return true;
    }

    private List<Notification> TakePending()
    {
        var batch = _pending;
        _pending = [];
        return batch;
    }

    private List<Notification> TakeAwaitingCommit()
    {
        var batch = _awaitingCommit;
        _awaitingCommit = [];
        return batch;
    }

    private async Task PublishAsync(List<Notification> batch, CancellationToken cancellationToken)
    {
        if (batch.Count == 0)
        {
            return;
        }

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
