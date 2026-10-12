using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.DTOs;
using MediatR;

namespace HRConnect.Application.Features.Notifications.Queries.GetUnreadNotificationCount;

public sealed record GetUnreadNotificationCountQuery(Guid UserId) : IRequest<UnreadNotificationCountDto>;

public sealed class GetUnreadNotificationCountQueryHandler : IRequestHandler<GetUnreadNotificationCountQuery, UnreadNotificationCountDto>
{
    private readonly INotificationRepository _notifications;

    public GetUnreadNotificationCountQueryHandler(INotificationRepository notifications) => _notifications = notifications;

    public async Task<UnreadNotificationCountDto> Handle(GetUnreadNotificationCountQuery request, CancellationToken cancellationToken)
    {
        var count = await _notifications.GetUnreadCountAsync(request.UserId, cancellationToken);
        return new UnreadNotificationCountDto(count);
    }
}
