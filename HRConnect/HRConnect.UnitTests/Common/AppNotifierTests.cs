using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Services;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Common;

public class AppNotifierTests
{
    [Fact]
    public async Task NotifyRoleAsync_AddsOneNotificationPerActiveUserWithRoute()
    {
        var hr = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var users = new Mock<IUserRepository>();
        users.Setup(u => u.GetActiveUserIdsByRoleAsync("INTERNAL_HR", It.IsAny<CancellationToken>())).ReturnsAsync(hr);
        var added = new List<Notification>();
        var repo = new Mock<INotificationRepository>();
        repo.Setup(r => r.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .Callback<Notification, CancellationToken>((n, _) => added.Add(n)).Returns(Task.CompletedTask);
        var entityId = Guid.NewGuid();

        await new AppNotifier(users.Object, repo.Object).NotifyRoleAsync(
            "INTERNAL_HR", new AppNotice("WARRANTY", "T", "M", "WARRANTY", entityId, "/hr/warranty-tracking"));

        added.Select(n => n.UserId).Should().BeEquivalentTo(hr);
        added.Should().OnlyContain(n => n.RelatedEntityType == "WARRANTY" && n.RelatedEntityId == entityId
            && n.Metadata!.Contains("/hr/warranty-tracking") && !n.IsRead);
    }

    [Fact]
    public async Task NotifyUsersAsync_SkipsEmptyAndDuplicateIds()
    {
        var id = Guid.NewGuid();
        var repo = new Mock<INotificationRepository>();
        await new AppNotifier(Mock.Of<IUserRepository>(), repo.Object).NotifyUsersAsync(
            [id, id, Guid.Empty], new AppNotice("X", "T", "M", "JOB", Guid.NewGuid()));
        repo.Verify(r => r.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
