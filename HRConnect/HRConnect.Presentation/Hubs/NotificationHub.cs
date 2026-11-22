using System.Security.Claims;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.DTOs;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

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
    private readonly ILogger<SignalRNotificationPublisher> _logger;

    public SignalRNotificationPublisher(
        IHubContext<NotificationHub> hub,
        IServiceScopeFactory scopeFactory,
        ILogger<SignalRNotificationPublisher>? logger = null)
    {
        _hub = hub;
        _scopeFactory = scopeFactory;
        _logger = logger ?? NullLogger<SignalRNotificationPublisher>.Instance;
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

    public async Task PublishApplicationScoredAsync(
        Guid applicationId,
        Guid jobId,
        string status,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await PushApplicationScoredCoreAsync(applicationId, jobId, status, db, _hub, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Could not push application.scored for ApplicationId={ApplicationId}.", applicationId);
        }
    }

    /// <summary>
    /// Pure recipient selection for "application.scored": Internal HR and Platform Admin always receive it;
    /// active company members receive it only when the application is already visible to the Client under
    /// <see cref="ClientVisibilityPolicy"/>.
    /// </summary>
    public static IReadOnlyList<Guid> SelectApplicationScoredRecipients(
        IEnumerable<Guid> staffUserIds,
        IEnumerable<Guid> companyMemberUserIds,
        string? serviceTypeCode,
        string? applicationStatus,
        IEnumerable<string?> historyNewStatuses,
        bool hasSourcingDelivery)
    {
        var includeClient = ClientVisibilityPolicy.IsVisibleToClient(
            serviceTypeCode, applicationStatus, historyNewStatuses, hasSourcingDelivery);
        return (includeClient ? staffUserIds.Concat(companyMemberUserIds) : staffUserIds)
            .Distinct()
            .ToList();
    }

    internal static async Task PushApplicationScoredCoreAsync(
        Guid applicationId,
        Guid jobId,
        string status,
        ApplicationDbContext db,
        IHubContext<NotificationHub> hub,
        CancellationToken cancellationToken)
    {
        var jobInfo = await db.Jobs.AsNoTracking()
            .Where(j => j.JobId == jobId)
            .Select(j => new
            {
                j.CompanyId,
                j.ServiceTypeId,
                ServiceTypeCode = j.ServiceType != null ? j.ServiceType.Code : null
            })
            .FirstOrDefaultAsync(cancellationToken);

        var serviceTypeCode = jobInfo?.ServiceTypeCode;
        if (string.IsNullOrWhiteSpace(serviceTypeCode) && jobInfo != null && jobInfo.ServiceTypeId != Guid.Empty)
        {
            serviceTypeCode = await db.ServiceTypes.AsNoTracking()
                .Where(st => st.ServiceTypeId == jobInfo.ServiceTypeId)
                .Select(st => st.Code)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var appInfo = await db.Applications.AsNoTracking()
            .Where(a => a.ApplicationId == applicationId)
            .Select(a => new
            {
                a.Status,
                HistoryNewStatuses = a.ApplicationStatusHistories.Select(h => h.NewStatus).ToList(),
                HasSourcingDelivery = a.SourcingDeliveries.Any()
            })
            .FirstOrDefaultAsync(cancellationToken);

        var staff = await db.UserRoles.AsNoTracking()
            .Where(ur => ur.Status == UserRoleAssignmentStates.Active
                && ur.Role.IsActive
                && (ur.Role.Code == RoleCodes.InternalHr || ur.Role.Code == RoleCodes.PlatformAdmin))
            .Select(ur => ur.UserId)
            .ToListAsync(cancellationToken);

        var members = jobInfo == null
            ? new List<Guid>()
            : await db.CompanyUsers.AsNoTracking()
                .Where(cu => cu.CompanyId == jobInfo.CompanyId && cu.Status == UserAccountStates.Active)
                .Select(cu => cu.UserId)
                .ToListAsync(cancellationToken);

        var recipients = SelectApplicationScoredRecipients(
            staff,
            members,
            serviceTypeCode,
            appInfo?.Status,
            appInfo?.HistoryNewStatuses ?? [],
            appInfo?.HasSourcingDelivery ?? false);

        var groups = recipients.Select(NotificationHub.UserGroup).ToList();
        if (groups.Count == 0)
        {
            return;
        }

        await hub.Clients.Groups(groups).SendAsync("application.scored", new
        {
            applicationId,
            jobId,
            status,
        }, cancellationToken);
    }
}
