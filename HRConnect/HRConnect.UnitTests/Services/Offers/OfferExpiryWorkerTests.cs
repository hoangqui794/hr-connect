using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Offers.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Audit;
using HRConnect.Infrastructure.Services.Offers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace HRConnect.UnitTests.Services.Offers;

public sealed class OfferExpiryWorkerTests
{
    [Fact]
    public async Task ExpireBatchAsync_ExpiredOffer_ExpiresAndNotifiesCandidate()
    {
        var services = CreateServices(Guid.NewGuid().ToString());
        await using var provider = services.BuildServiceProvider();
        var fixture = CreateOffer(DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)));

        await using (var scope = provider.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Offers.Add(fixture.Offer);
            await db.SaveChangesAsync();
        }

        var worker = new OfferExpiryWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<OfferExpiryWorker>.Instance);
        await worker.ExpireBatchAsync(CancellationToken.None);

        await using var verificationScope = provider.CreateAsyncScope();
        var verification = verificationScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var offer = await verification.Offers.SingleAsync();
        offer.Status.Should().Be("EXPIRED");
        offer.ConcurrencyToken.Should().NotBe(fixture.OriginalConcurrencyToken);

        var application = await verification.Applications.SingleAsync();
        application.Status.Should().Be("OFFER_PENDING");

        var notification = await verification.Notifications.SingleAsync();
        notification.UserId.Should().Be(fixture.CandidateUserId);
        notification.NotificationType.Should().Be("OFFER");
        notification.RelatedEntityId.Should().Be(fixture.Offer.OfferId);

        var audit = await verification.AuditLogs.SingleAsync();
        audit.Action.Should().Be(AuditActions.OfferExpired);
        audit.ActorUserId.Should().BeNull();
        audit.ActorType.Should().Be(AuditActorTypes.Service);
        audit.Source.Should().Be(AuditSources.BackgroundWorker);
        audit.ServiceName.Should().Be("OFFER_EXPIRY_WORKER");
        using var newValues = JsonDocument.Parse(audit.NewValues!);
        newValues.RootElement.GetProperty("status").GetString().Should().Be("EXPIRED");
    }

    [Fact]
    public async Task ExpireBatchAsync_OfferStillWithinExpiryDate_DoesNothing()
    {
        var services = CreateServices(Guid.NewGuid().ToString());
        await using var provider = services.BuildServiceProvider();
        var fixture = CreateOffer(DateOnly.FromDateTime(DateTime.UtcNow));

        await using (var scope = provider.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Offers.Add(fixture.Offer);
            await db.SaveChangesAsync();
        }

        var worker = new OfferExpiryWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<OfferExpiryWorker>.Instance);
        await worker.ExpireBatchAsync(CancellationToken.None);

        await using var verificationScope = provider.CreateAsyncScope();
        var verification = verificationScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await verification.Offers.SingleAsync()).Status.Should().Be("SENT");
        (await verification.Notifications.AnyAsync()).Should().BeFalse();
        (await verification.AuditLogs.AnyAsync()).Should().BeFalse();
    }

    private static ServiceCollection CreateServices(string databaseName)
    {
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(databaseName));
        services.AddScoped<IOfferRepository, OfferRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IOfferExpiryService, OfferExpiryService>();
        services.AddSingleton(Mock.Of<IRequestContext>());
        return services;
    }

    private static OfferFixture CreateOffer(DateOnly expiryDate)
    {
        var now = DateTime.UtcNow;
        var candidateUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            Email = "candidate@example.com",
            PasswordHash = "hash",
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = candidateUser.UserId,
            User = candidateUser,
            FullName = "Nguyen Van A",
            Email = candidateUser.Email,
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Backend Developer",
            CurrencyCode = "VND",
            Status = "ACTIVE",
            Visibility = "PUBLIC",
            CreatedAt = now,
            UpdatedAt = now
        };
        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            JobId = job.JobId,
            Job = job,
            Status = "OFFER_PENDING",
            AppliedAt = now.AddDays(-7),
            UpdatedAt = now.AddDays(-1)
        };
        var offer = new Offer
        {
            OfferId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            Application = application,
            OfferVersion = 1,
            CurrencyCode = "VND",
            Status = "SENT",
            SentAt = now.AddDays(-2),
            ExpiryDate = expiryDate,
            CreatedAt = now.AddDays(-3),
            UpdatedAt = now.AddDays(-2),
            ConcurrencyToken = Guid.NewGuid()
        };
        return new OfferFixture(offer, candidateUser.UserId, offer.ConcurrencyToken);
    }

    private sealed record OfferFixture(Offer Offer, Guid CandidateUserId, Guid OriginalConcurrencyToken);
}
