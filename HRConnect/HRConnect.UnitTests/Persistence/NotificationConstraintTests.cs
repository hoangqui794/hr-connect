using FluentAssertions;
using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HRConnect.UnitTests.Persistence;

public sealed class NotificationConstraintTests
{
    [Fact]
    public void NotificationTypeConstraint_AllowsSubmissionConsentResult()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only")
            .Options;

        using var context = new ApplicationDbContext(options);
        var designTimeModel = context.GetService<IDesignTimeModel>().Model;
        var notification = designTimeModel.FindEntityType(typeof(Notification));

        notification.Should().NotBeNull();
        var constraint = notification!.GetCheckConstraints()
            .Single(item => item.Name == "ck_notification_type");

        constraint.Sql.Should().Contain($"'{SubmissionConsentNotificationFactory.NotificationType}'");
    }
}
