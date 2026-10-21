using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Notifications.DTOs;
using HRConnect.Domain.Entities;
using HRConnect.Presentation.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace HRConnect.UnitTests.Presentation.Hubs;

public sealed class SignalRNotificationPublisherTests
{
    [Fact]
    public async Task PublishAsync_ShouldSendCanonicalDto_WithRouteHintAndUnreadCount()
    {
        var userId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var notification = new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            NotificationType = "OFFER_SENT",
            Title = "Thư nhận việc mới",
            Message = "Bạn có thư nhận việc mới",
            RelatedEntityType = "OFFER",
            RelatedEntityId = offerId,
            Metadata = $"{{\"applicationId\":\"{applicationId}\",\"offerId\":\"{offerId}\"}}",
            CreatedAt = DateTime.UtcNow
        };

        var repository = new Mock<INotificationRepository>();
        repository.Setup(x => x.GetUnreadCountAsync(userId, It.IsAny<CancellationToken>())).ReturnsAsync(4);

        var serviceProvider = new ServiceCollection()
            .AddSingleton(repository.Object)
            .BuildServiceProvider();
        var scope = new Mock<IServiceScope>();
        scope.SetupGet(x => x.ServiceProvider).Returns(serviceProvider);
        var scopeFactory = new Mock<IServiceScopeFactory>();
        scopeFactory.Setup(x => x.CreateScope()).Returns(scope.Object);

        object? envelope = null;
        var client = new Mock<IClientProxy>();
        client.Setup(x => x.SendCoreAsync("notification.created", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Callback<string, object?[], CancellationToken>((_, args, _) => envelope = args[0])
            .Returns(Task.CompletedTask);
        var clients = new Mock<IHubClients>();
        clients.Setup(x => x.Group(NotificationHub.UserGroup(userId))).Returns(client.Object);
        var hub = new Mock<IHubContext<NotificationHub>>();
        hub.SetupGet(x => x.Clients).Returns(clients.Object);

        var publisher = new SignalRNotificationPublisher(hub.Object, scopeFactory.Object);
        await publisher.PublishAsync([notification]);

        envelope.Should().NotBeNull();
        var envelopeType = envelope!.GetType();
        var sentNotification = envelopeType.GetProperty("notification")!.GetValue(envelope);
        var unreadCount = envelopeType.GetProperty("unreadCount")!.GetValue(envelope);

        sentNotification.Should().BeOfType<NotificationDto>();
        ((NotificationDto)sentNotification!).RouteHint.Should().Be($"/candidate/applications/{applicationId}");
        unreadCount.Should().Be(4);
        clients.Verify(x => x.Group(NotificationHub.UserGroup(userId)), Times.Once);
    }
}
