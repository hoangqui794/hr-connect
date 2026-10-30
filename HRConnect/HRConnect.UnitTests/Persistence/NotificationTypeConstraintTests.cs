using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HRConnect.UnitTests.Persistence;

public sealed class NotificationTypeConstraintTests
{
    // IAppNotifier sends these types: recording a service fee payment, a resignation report and a CV delivery
    // failed with a 500 while the database constraint did not list them.
    [Theory]
    [InlineData("SERVICE_FEE")]
    [InlineData("WARRANTY")]
    [InlineData("SOURCING")]
    [InlineData("INTERVIEW")]
    [InlineData("SYSTEM")]
    public void Notification_type_constraint_allows_every_type_the_notifier_sends(string type)
    {
        using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);

        var model = context.GetService<IDesignTimeModel>().Model;
        var constraint = model.FindEntityType(typeof(Notification))!.GetCheckConstraints()
            .Single(c => c.Name == "ck_notification_type");

        constraint.Sql.Should().Contain($"'{type}'");
    }
}
