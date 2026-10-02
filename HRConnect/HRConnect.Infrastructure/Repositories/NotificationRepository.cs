using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;

namespace HRConnect.Infrastructure.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly ApplicationDbContext _context;
    public NotificationRepository(ApplicationDbContext context) => _context = context;
    public Task AddAsync(Notification notification, CancellationToken cancellationToken = default) =>
        _context.Notifications.AddAsync(notification, cancellationToken).AsTask();
}
