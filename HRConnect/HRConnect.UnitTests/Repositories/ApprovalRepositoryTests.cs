using FluentAssertions;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;

namespace HRConnect.UnitTests.Repositories;

public class ApprovalRepositoryTests
{
    [Fact]
    public async Task GetApprovalsAsync_WithPendingFilter_ShouldOnlyReturnOtpVerifiedQueue()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var context = new ApplicationDbContext(options);
        var waitingForOtpUser = CreateUser("waiting@example.com", emailVerifiedAt: null);
        var underReviewUser = CreateUser("review@example.com", DateTime.UtcNow);

        await context.AppUsers.AddRangeAsync(waitingForOtpUser, underReviewUser);
        await context.AffiliateApplications.AddRangeAsync(
            CreateApplication(waitingForOtpUser.UserId, "PENDING"),
            CreateApplication(underReviewUser.UserId, "UNDER_REVIEW"));
        await context.SaveChangesAsync();

        var repository = new ApprovalRepository(context);

        var (items, totalCount) = await repository.GetApprovalsAsync(
            type: "AFFILIATE",
            status: "PENDING",
            search: null,
            sortBy: "submittedAt",
            sortDirection: "desc",
            page: 1,
            pageSize: 20);

        totalCount.Should().Be(1);
        items.Should().ContainSingle();
        items[0].Email.Should().Be("review@example.com");
        items[0].Status.Should().Be("UNDER_REVIEW");
    }

    [Fact]
    public async Task GetApprovalsAsync_WithoutStatusFilter_ShouldNeverReturnUnverifiedPendingRecords()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var context = new ApplicationDbContext(options);
        var pendingUser = CreateUser("pending@example.com", emailVerifiedAt: null);
        var approvedUser = CreateUser("approved@example.com", DateTime.UtcNow);

        await context.AppUsers.AddRangeAsync(pendingUser, approvedUser);
        await context.AffiliateApplications.AddRangeAsync(
            CreateApplication(pendingUser.UserId, "PENDING"),
            CreateApplication(approvedUser.UserId, "APPROVED"));
        await context.SaveChangesAsync();

        var repository = new ApprovalRepository(context);
        var (items, totalCount) = await repository.GetApprovalsAsync(
            type: "AFFILIATE",
            status: null,
            search: null,
            sortBy: "submittedAt",
            sortDirection: "desc",
            page: 1,
            pageSize: 20);

        totalCount.Should().Be(1);
        items.Should().ContainSingle(item => item.Email == "approved@example.com");
        items.Should().NotContain(item => item.Status == "PENDING");
    }

    private static AppUser CreateUser(string email, DateTime? emailVerifiedAt) => new()
    {
        UserId = Guid.NewGuid(),
        Email = email,
        PasswordHash = "hash",
        DisplayName = email,
        Status = "PENDING",
        EmailVerifiedAt = emailVerifiedAt
    };

    private static AffiliateApplication CreateApplication(Guid userId, string status) => new()
    {
        AffiliateApplicationId = Guid.NewGuid(),
        UserId = userId,
        AffiliateType = "RECRUITER",
        Status = status,
        SubmittedData = "{}",
        SubmittedAt = DateTime.UtcNow
    };
}
