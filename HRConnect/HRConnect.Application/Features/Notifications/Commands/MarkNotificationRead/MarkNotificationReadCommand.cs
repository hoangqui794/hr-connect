using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.DTOs;
using MediatR;

namespace HRConnect.Application.Features.Notifications.Commands.MarkNotificationRead;

public sealed record MarkNotificationReadCommand(Guid NotificationId, Guid UserId) : IRequest<MarkNotificationReadResponse>;

public sealed class MarkNotificationReadCommandHandler : IRequestHandler<MarkNotificationReadCommand, MarkNotificationReadResponse>
{
    private readonly INotificationRepository _notifications;

    public MarkNotificationReadCommandHandler(INotificationRepository notifications) => _notifications = notifications;

    public async Task<MarkNotificationReadResponse> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
    {
        var updated = await _notifications.MarkAsReadAsync(request.NotificationId, request.UserId, cancellationToken);
        if (!updated)
        {
            throw new NotFoundException("Không tìm thấy thông báo hoặc thông báo không thuộc về bạn.");
        }

        return new MarkNotificationReadResponse(true, "Đã đánh dấu thông báo là đã đọc.", 1);
    }
}
