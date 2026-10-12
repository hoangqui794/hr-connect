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
