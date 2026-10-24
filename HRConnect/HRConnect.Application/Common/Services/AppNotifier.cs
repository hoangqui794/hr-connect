using System.Text.Json;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Services;

public sealed class AppNotifier : IAppNotifier
{
    private readonly IUserRepository _users;
    private readonly INotificationRepository _notifications;

    public AppNotifier(IUserRepository users, INotificationRepository notifications)
    {
        _users = users;
        _notifications = notifications;
    }

    public async Task NotifyUsersAsync(IEnumerable<Guid> userIds, AppNotice notice, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var metadata = JsonSerializer.Serialize(new { routeHint = notice.RouteHint, entityId = notice.RelatedEntityId });
        foreach (var userId in userIds.Where(id => id != Guid.Empty).Distinct())
        {
            await _notifications.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = userId,
                NotificationType = notice.NotificationType,
                Title = notice.Title,
                Message = notice.Message,
                RelatedEntityType = notice.RelatedEntityType,
                RelatedEntityId = notice.RelatedEntityId,
                Metadata = metadata,
                IsRead = false,
                CreatedAt = now,
            }, cancellationToken);
        }
    }

    public async Task NotifyRoleAsync(string roleCode, AppNotice notice, CancellationToken cancellationToken = default)
        => await NotifyUsersAsync(await _users.GetActiveUserIdsByRoleAsync(roleCode, cancellationToken), notice, cancellationToken);

    public async Task NotifyCompanyAsync(Guid companyId, AppNotice notice, CancellationToken cancellationToken = default)
        => await NotifyUsersAsync(await _users.GetActiveUserIdsByCompanyAsync(companyId, cancellationToken), notice, cancellationToken);
}
