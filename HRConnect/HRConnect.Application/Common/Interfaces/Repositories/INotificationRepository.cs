using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces.Repositories;

public interface INotificationRepository
{
    Task AddAsync(Notification notification, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(
        Guid userId,
        string notificationType,
        string relatedEntityType,
        Guid relatedEntityId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Metadata (JSON) of the user's notifications of one type about one entity. Only a handful of rows
    /// exist per entity, so callers parse them in memory instead of querying inside the jsonb column.
    /// </summary>
    Task<IReadOnlyList<string>> GetMetadataAsync(
        Guid userId,
        string notificationType,
        string relatedEntityType,
        Guid relatedEntityId,
        CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<Notification> Items, int TotalCount)> GetUserNotificationsAsync(
        Guid userId,
        string? notificationType,
        bool? isRead,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default);

    Task<int> GetUnreadCountAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<bool> MarkAsReadAsync(
        Guid notificationId,
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<int> MarkAllAsReadAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
