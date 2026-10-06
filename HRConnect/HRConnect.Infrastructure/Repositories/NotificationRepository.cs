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
}
