using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.SubmissionConsents.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Audit;
using HRConnect.Infrastructure.Services.SubmissionConsents;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace HRConnect.UnitTests.Services.SubmissionConsents;

public sealed class SubmissionConsentExpiryWorkerTests
{
    [Fact]
    public async Task ExpireBatchAsync_ExpiredConsent_ClosesGraphAndWritesNotificationAndAudit()
    {
        var databaseName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(databaseName));
        AddExpiryServices(services);
        await using var provider = services.BuildServiceProvider();
        var fixture = CreateConsent(DateTime.UtcNow.AddMinutes(-1));

        await using (var seedScope = provider.CreateAsyncScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.SubmissionConsents.Add(fixture.Consent);
            await db.SaveChangesAsync();
        }

        var worker = new SubmissionConsentExpiryWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<SubmissionConsentExpiryWorker>.Instance);

        await worker.ExpireBatchAsync(CancellationToken.None);

        await using var verificationScope = provider.CreateAsyncScope();
        var verification = verificationScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var consent = await verification.SubmissionConsents
            .Include(item => item.Submission).ThenInclude(item => item.CandidateCv)
            .SingleAsync();
        consent.Status.Should().Be("EXPIRED");
        consent.Submission.Status.Should().Be("CONSENT_EXPIRED");
        consent.Submission.CandidateCv.Status.Should().Be("ARCHIVED");
        consent.ConcurrencyToken.Should().NotBe(fixture.OriginalConcurrencyToken);

        var notification = await verification.Notifications.SingleAsync();
        notification.UserId.Should().Be(fixture.AffiliateUserId);
        notification.RelatedEntityId.Should().Be(fixture.Consent.SubmissionId);

        var audit = await verification.AuditLogs.SingleAsync();
        audit.Action.Should().Be(AuditActions.SubmissionConsentExpired);
        audit.ActorUserId.Should().BeNull();
        audit.EntityId.Should().Be(fixture.Consent.SubmissionId);
        audit.CorrelationId.Should().Be(fixture.Consent.ConsentId);
        using var newValues = JsonDocument.Parse(audit.NewValues!);
        newValues.RootElement.GetProperty("consentStatus").GetString().Should().Be("EXPIRED");
        newValues.RootElement.GetProperty("submissionStatus").GetString().Should().Be("CONSENT_EXPIRED");
        newValues.RootElement.GetProperty("source").GetString().Should().Be("BACKGROUND_WORKER");
    }

    [Fact]
    public async Task ExpireBatchAsync_UnexpiredConsent_DoesNotChangeOrAudit()
    {
        var databaseName = Guid.NewGuid().ToString();
        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(databaseName));
        AddExpiryServices(services);
        await using var provider = services.BuildServiceProvider();
        var fixture = CreateConsent(DateTime.UtcNow.AddHours(1));
        await using (var seedScope = provider.CreateAsyncScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.SubmissionConsents.Add(fixture.Consent);
            await db.SaveChangesAsync();
        }

        var worker = new SubmissionConsentExpiryWorker(
            provider.GetRequiredService<IServiceScopeFactory>(),
            NullLogger<SubmissionConsentExpiryWorker>.Instance);
        await worker.ExpireBatchAsync(CancellationToken.None);

        await using var verificationScope = provider.CreateAsyncScope();
        var verification = verificationScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await verification.SubmissionConsents.SingleAsync()).Status.Should().Be("PENDING");
        (await verification.AuditLogs.AnyAsync()).Should().BeFalse();
        (await verification.Notifications.AnyAsync()).Should().BeFalse();
    }

    private static ConsentFixture CreateConsent(DateTime expiresAt)
    {
        var now = DateTime.UtcNow;
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Nguyễn Văn Ứng Viên",
            Email = "candidate@example.com",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CreatedAt = now,
            UpdatedAt = now
        };
        var cv = new CandidateCv
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            Title = "CV ứng tuyển",
            CreationMethod = "AFFILIATE_UPLOAD",
            Status = "PENDING_CONSENT",
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
        var affiliateUserId = Guid.NewGuid();
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            CvId = cv.CvId,
            CandidateCv = cv,
            JobId = job.JobId,
            Job = job,
            SubmittedBy = affiliateUserId,
            Source = "AFFILIATE",
            Status = "PENDING_CONSENT",
            SubmittedAt = now,
            UpdatedAt = now
        };
        var consent = new SubmissionConsent
        {
            ConsentId = Guid.NewGuid(),
            SubmissionId = submission.SubmissionId,
            Submission = submission,
            RecipientEmail = "candidate@example.com",
            TokenHash = Guid.NewGuid().ToString("N"),
            Status = "PENDING",
            RequestedAt = now.AddHours(-1),
            ExpiresAt = expiresAt,
            CreatedAt = now.AddHours(-1),
            UpdatedAt = now.AddHours(-1)
        };
        return new ConsentFixture(consent, affiliateUserId, consent.ConcurrencyToken);
    }

    private static void AddExpiryServices(IServiceCollection services)
    {
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<ISubmissionConsentExpiryService, SubmissionConsentExpiryService>();
        services.AddSingleton(Mock.Of<IRequestContext>());
    }

    private sealed record ConsentFixture(
        SubmissionConsent Consent,
        Guid AffiliateUserId,
        Guid OriginalConcurrencyToken);
}
