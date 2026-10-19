using HRConnect.Domain.Entities;

namespace HRConnect.Application.Common.Interfaces;

/// <summary>
/// BE-04 D: pushes notifications to connected users in real time once they are saved
/// (SignalR in the API; a no-op where no hub is running, e.g. tests). Failures never break the save.
/// </summary>
public interface INotificationPublisher
{
    Task PublishAsync(IReadOnlyList<Notification> notifications, CancellationToken cancellationToken = default);
}
