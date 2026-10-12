using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.Infrastructure.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly ApplicationDbContext _context;
    public NotificationRepository(ApplicationDbContext context) => _context = context;
    public Task AddAsync(Notification notification, CancellationToken cancellationToken = default) =>
        _context.Notifications.AddAsync(notification, cancellationToken).AsTask();

    public Task<bool> ExistsAsync(
        Guid userId,
        string notificationType,
        string relatedEntityType,
        Guid relatedEntityId,
        CancellationToken cancellationToken = default) =>
        _context.Notifications.AnyAsync(notification =>
            notification.UserId == userId &&
            notification.NotificationType == notificationType &&
            notification.RelatedEntityType == relatedEntityType &&
            notification.RelatedEntityId == relatedEntityId,
            cancellationToken);

    public async Task<(IReadOnlyList<Notification> Items, int TotalCount)> GetUserNotificationsAsync(
        Guid userId,
        string? notificationType,
        bool? isRead,
        int page,
        int pageSize,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Notifications.AsNoTracking()
            .Where(n => n.UserId == userId);

        if (!string.IsNullOrWhiteSpace(notificationType))
        {
            var normalizedType = notificationType.Trim().ToUpperInvariant();
            query = query.Where(n => n.NotificationType == normalizedType);
        }

        if (isRead.HasValue)
        {
            query = query.Where(n => n.IsRead == isRead.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .ThenByDescending(n => n.NotificationId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _context.Notifications.AsNoTracking()
            .CountAsync(n => n.UserId == userId && !n.IsRead, cancellationToken);

    public async Task<bool> MarkAsReadAsync(Guid notificationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var notification = await _context.Notifications
            .FirstOrDefaultAsync(n => n.NotificationId == notificationId && n.UserId == userId, cancellationToken);

        if (notification == null) return false;

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }

        return true;
    }

    public async Task<int> MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var unread = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(cancellationToken);

        if (unread.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var n in unread)
        {
            n.IsRead = true;
            n.ReadAt = now;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return unread.Count;
    }
}
