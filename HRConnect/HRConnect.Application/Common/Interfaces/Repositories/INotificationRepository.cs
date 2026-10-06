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
}
