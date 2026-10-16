using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HRConnect.UnitTests.Persistence;

public sealed class RegistrationApprovalConcurrencySchemaTests
{
    private static IModel GetModel()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=localhost;Database=model_only;Username=model_only;Password=model_only")
            .Options;

        using var context = new ApplicationDbContext(options);
        return context.Model;
    }

    [Fact]
    public void ApprovalStatuses_AreConcurrencyProtected()
    {
        var model = GetModel();

        model.FindEntityType(typeof(AffiliateApplication))!
            .FindProperty(nameof(AffiliateApplication.Status))!
            .IsConcurrencyToken.Should().BeTrue();
        model.FindEntityType(typeof(CompanyVerificationRequest))!
            .FindProperty(nameof(CompanyVerificationRequest.Status))!
            .IsConcurrencyToken.Should().BeTrue();
    }

    [Fact]
    public void OtpAttemptAndConsumption_AreConcurrencyProtected()
    {
        var token = GetModel().FindEntityType(typeof(UserToken))!;

        token.FindProperty(nameof(UserToken.AttemptCount))!
            .IsConcurrencyToken.Should().BeTrue();
        token.FindProperty(nameof(UserToken.UsedAt))!
            .IsConcurrencyToken.Should().BeTrue();
    }
}
