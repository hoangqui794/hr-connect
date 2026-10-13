using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.DTOs;
using MediatR;

namespace HRConnect.Application.Features.Notifications.Queries.GetNotifications;

public sealed record GetNotificationsQuery(
    Guid UserId,
    string? Type = null,
    bool? IsRead = null,
    int Page = 1,
    int PageSize = 20) : IRequest<NotificationPageDto>;

public sealed class GetNotificationsQueryHandler : IRequestHandler<GetNotificationsQuery, NotificationPageDto>
{
    private readonly INotificationRepository _notifications;

    public GetNotificationsQueryHandler(INotificationRepository notifications) => _notifications = notifications;

    public async Task<NotificationPageDto> Handle(GetNotificationsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var (items, totalCount) = await _notifications.GetUserNotificationsAsync(
            request.UserId,
            request.Type,
            request.IsRead,
            page,
            pageSize,
            cancellationToken);

        var dtos = items.Select(NotificationDto.From).ToList();
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new NotificationPageDto(
            dtos,
            page,
            pageSize,
            totalCount,
            totalPages);
    }
}
