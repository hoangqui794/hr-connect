using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.Commands.MarkAllNotificationsRead;
using HRConnect.Application.Features.Notifications.Commands.MarkNotificationRead;
using HRConnect.Application.Features.Notifications.Queries.GetNotifications;
using HRConnect.Application.Features.Notifications.Queries.GetUnreadNotificationCount;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Notifications;

public class NotificationFeatureTests
{
    private readonly Mock<INotificationRepository> _notificationRepo = new();

    [Fact]
    public async Task GetNotifications_ShouldReturnPaginatedResults_WithResolvedRouteHints()
    {
        var userId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var notifications = new List<Notification>
        {
            new()
            {
                NotificationId = Guid.NewGuid(),
                UserId = userId,
                NotificationType = "JOB",
                Title = "Tin tuyển dụng mới",
                Message = "Có tin tuyển dụng mới phù hợp",
                RelatedEntityType = "JOB",
                RelatedEntityId = jobId,
                Metadata = "{}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                NotificationId = Guid.NewGuid(),
                UserId = userId,
                NotificationType = "APPLICATION_STATUS",
                Title = "Hồ sơ được cập nhật",
                Message = "Hồ sơ ứng tuyển đã được duyệt qua vòng hồ sơ",
                RelatedEntityType = "APPLICATION",
                RelatedEntityId = Guid.NewGuid(),
                Metadata = "{}",
                IsRead = true,
                ReadAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            }
        };

        _notificationRepo.Setup(x => x.GetUserNotificationsAsync(userId, null, null, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((notifications, 2));

        var handler = new GetNotificationsQueryHandler(_notificationRepo.Object);
        var result = await handler.Handle(new GetNotificationsQuery(userId, Page: 1, PageSize: 20), CancellationToken.None);

        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Items[0].RouteHint.Should().Be($"/jobs/{jobId}");
        result.Items[0].IsRead.Should().BeFalse();
        result.Items[1].RouteHint.Should().Be("/candidate/applications");
        result.Items[1].IsRead.Should().BeTrue();
    }

    [Fact]
    public async Task GetUnreadNotificationCount_ShouldReturnAccurateCount()
    {
        var userId = Guid.NewGuid();
        _notificationRepo.Setup(x => x.GetUnreadCountAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(5);

        var handler = new GetUnreadNotificationCountQueryHandler(_notificationRepo.Object);
        var result = await handler.Handle(new GetUnreadNotificationCountQuery(userId), CancellationToken.None);

        result.UnreadCount.Should().Be(5);
    }

    [Fact]
    public async Task MarkNotificationRead_ShouldSucceed_WhenNotificationBelongsToUser()
    {
        var userId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();

        _notificationRepo.Setup(x => x.MarkAsReadAsync(notificationId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var handler = new MarkNotificationReadCommandHandler(_notificationRepo.Object);
        var result = await handler.Handle(new MarkNotificationReadCommand(notificationId, userId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.UpdatedCount.Should().Be(1);
    }

    [Fact]
    public async Task MarkNotificationRead_ShouldThrowNotFound_WhenNotOwner()
    {
        var userId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();

        _notificationRepo.Setup(x => x.MarkAsReadAsync(notificationId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var handler = new MarkNotificationReadCommandHandler(_notificationRepo.Object);
        var action = () => handler.Handle(new MarkNotificationReadCommand(notificationId, userId), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task MarkAllNotificationsRead_ShouldBeIdempotent()
    {
        var userId = Guid.NewGuid();

        _notificationRepo.Setup(x => x.MarkAllAsReadAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(3);

        var handler = new MarkAllNotificationsReadCommandHandler(_notificationRepo.Object);
        var result = await handler.Handle(new MarkAllNotificationsReadCommand(userId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.UpdatedCount.Should().Be(3);
    }
}
