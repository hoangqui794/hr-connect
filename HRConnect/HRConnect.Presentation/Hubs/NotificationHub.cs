using System.Security.Claims;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.DTOs;
using HRConnect.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HRConnect.Presentation.Hubs;

/// <summary>
/// BE-04 D: realtime bell. Connect to /hubs/notifications with the JWT as the access_token query
/// parameter; each user joins its own group. Events: "notification.created" { notification, unreadCount }
/// and, for interview notifications, "interview.updated" { interviewId }; "application.scored"
/// { applicationId, jobId, status } when an AI scoring attempt finishes (MF-03).
/// The FE keeps polling as a fallback when the connection drops.
/// </summary>
[Authorize]
public sealed class NotificationHub : Hub
{
    public const string Path = "/hubs/notifications";

    public static string UserGroup(Guid userId) => $"user:{userId}";

    public override async Task OnConnectedAsync()
    {
        var id = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? Context.User?.FindFirstValue("sub");
        if (Guid.TryParse(id, out var userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(userId));
        }

        await base.OnConnectedAsync();
    }
}

public sealed class SignalRNotificationPublisher : INotificationPublisher
{
    private readonly IHubContext<NotificationHub> _hub;
    private readonly IServiceScopeFactory _scopeFactory;

    public SignalRNotificationPublisher(IHubContext<NotificationHub> hub, IServiceScopeFactory scopeFactory)
    {
        _hub = hub;
        _scopeFactory = scopeFactory;
    }

    public async Task PublishAsync(IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default)
    {
        // A fresh scope: the caller's DbContext is still inside SaveChanges.
        await using var scope = _scopeFactory.CreateAsyncScope();
        var repository = scope.ServiceProvider.GetRequiredService<INotificationRepository>();

        foreach (var group in notifications.GroupBy(n => n.UserId))
        {
            var unreadCount = await repository.GetUnreadCountAsync(group.Key, cancellationToken);
            var client = _hub.Clients.Group(NotificationHub.UserGroup(group.Key));
            foreach (var notification in group)
            {
                await client.SendAsync("notification.created", new
                {
                    notification = NotificationDto.From(notification),
                    unreadCount
                }, cancellationToken);

                if (string.Equals(notification.RelatedEntityType, "INTERVIEW", StringComparison.OrdinalIgnoreCase))
                {
                    await client.SendAsync("interview.updated", new { interviewId = notification.RelatedEntityId }, cancellationToken);
                }
            }
        }
    }
}
