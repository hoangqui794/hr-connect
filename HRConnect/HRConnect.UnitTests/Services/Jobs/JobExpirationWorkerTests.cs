using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Services.Jobs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Services.Jobs;

public class JobExpirationWorkerTests
{
    private static (ServiceProvider Provider, Mock<INotificationRepository> Notifications) BuildWorkerHost(string dbName)
    {
        var notifications = new Mock<INotificationRepository>();
        notifications
            .Setup(x => x.AddAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var services = new ServiceCollection();
        services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(dbName));
        services.AddSingleton(notifications.Object);

        return (services.BuildServiceProvider(), notifications);
    }

    private static async Task<Guid> SeedExpiredJobAsync(
        ServiceProvider provider,
        string packageCode,
        string packageName,
        int durationDays)
    {
        await using var scope = provider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var pkgId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        var jobId = Guid.NewGuid();

        db.JobPostingPackages.Add(new JobPostingPackage
        {
            PackageId = pkgId,
            Code = packageCode,
            Name = packageName,
            Price = packageCode == JobPostingPackageCodes.Free ? 0m : 1_000_000m,
            DurationDays = durationDays,
            IsActive = true,
            CreatedAt = DateTime.UtcNow.AddDays(-30),
        });
        db.ServiceTypes.Add(new ServiceType
        {
            ServiceTypeId = serviceTypeId,
            Code = ServiceTypeCodes.CvApplication,
            Name = "Đăng tin tuyển dụng",
            IsActive = true,
        });
        db.Companies.Add(new Company
        {
            CompanyId = companyId,
            CompanyName = "Test Co",
            VerificationStatus = "VERIFIED",
            CreatedAt = DateTime.UtcNow.AddDays(-30),
            UpdatedAt = DateTime.UtcNow.AddDays(-30),
        });
        db.Jobs.Add(new Job
        {
            JobId = jobId,
            CompanyId = companyId,
            ServiceTypeId = serviceTypeId,
            PostingPackageId = pkgId,
            CreatedBy = creatorId,
            Title = "Backend .NET Developer",
            Status = JobStatuses.Active,
            Quantity = 1,
            CurrencyCode = "VND",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5),
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow.AddDays(-durationDays),
            UpdatedAt = DateTime.UtcNow.AddDays(-durationDays),
        });

        await db.SaveChangesAsync();
        return jobId;
    }

    [Fact]
    public async Task ExpireJobsBatchAsync_PaidPackage_ShouldUsePackageDurationDaysAndOmitUpgradeHint()
    {
        var (provider, notifications) = BuildWorkerHost(Guid.NewGuid().ToString());
        await using (provider)
        {
            var jobId = await SeedExpiredJobAsync(provider, JobPostingPackageCodes.Standard, "Standard", durationDays: 45);
            var worker = new JobExpirationWorker(
                provider.GetRequiredService<IServiceScopeFactory>(),
                NullLogger<JobExpirationWorker>.Instance);

            var expiredCount = await worker.ExpireJobsBatchAsync(CancellationToken.None);

            expiredCount.Should().Be(1);
            notifications.Verify(x => x.AddAsync(It.Is<Notification>(n =>
                n.RelatedEntityId == jobId &&
                n.Message.Contains("(45 ngày)") &&
                !n.Message.Contains("30 ngày") &&
                !n.Message.Contains("STANDARD") &&
                !n.Message.Contains("Gói Tiêu Chuẩn")),
                It.IsAny<CancellationToken>()), Times.Once);
        }
    }

    [Fact]
    public async Task ExpireJobsBatchAsync_FreePackage_ShouldUseFreeDurationDaysAndSuggestStandardUpgrade()
    {
        var (provider, notifications) = BuildWorkerHost(Guid.NewGuid().ToString());
        await using (provider)
        {
            var jobId = await SeedExpiredJobAsync(provider, JobPostingPackageCodes.Free, "Free", durationDays: 7);
            var worker = new JobExpirationWorker(
                provider.GetRequiredService<IServiceScopeFactory>(),
                NullLogger<JobExpirationWorker>.Instance);

            var expiredCount = await worker.ExpireJobsBatchAsync(CancellationToken.None);

            expiredCount.Should().Be(1);
            notifications.Verify(x => x.AddAsync(It.Is<Notification>(n =>
                n.RelatedEntityId == jobId &&
                n.Message.Contains("(7 ngày)") &&
                !n.Message.Contains("30 ngày") &&
                n.Message.Contains("Gói Tiêu Chuẩn (STANDARD)")),
                It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
