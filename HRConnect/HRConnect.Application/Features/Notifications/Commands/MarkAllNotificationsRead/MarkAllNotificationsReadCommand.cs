using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.DTOs;
using MediatR;

namespace HRConnect.Application.Features.Notifications.Commands.MarkAllNotificationsRead;

public sealed record MarkAllNotificationsReadCommand(Guid UserId) : IRequest<MarkNotificationReadResponse>;

public sealed class MarkAllNotificationsReadCommandHandler : IRequestHandler<MarkAllNotificationsReadCommand, MarkNotificationReadResponse>
{
    private readonly INotificationRepository _notifications;

    public MarkAllNotificationsReadCommandHandler(INotificationRepository notifications) => _notifications = notifications;

    public async Task<MarkNotificationReadResponse> Handle(MarkAllNotificationsReadCommand request, CancellationToken cancellationToken)
    {
        var count = await _notifications.MarkAllAsReadAsync(request.UserId, cancellationToken);
        return new MarkNotificationReadResponse(true, "Đã đánh dấu tất cả thông báo là đã đọc.", count);
    }
}
