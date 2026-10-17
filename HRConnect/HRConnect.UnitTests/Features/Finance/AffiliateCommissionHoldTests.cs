using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Finance;

/// <summary>
/// Decision 2026-10-17: a suspended affiliate keeps what is earned; PENDING / IN_WARRANTY goes ON_HOLD
/// and comes back when the account is reactivated.
/// </summary>
public class AffiliateCommissionHoldTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();

    private AffiliateCommissionHoldService Service() => new(new FinanceRepository(_context), new UnitOfWork(_context), _audit.Object);

    private (AppUser User, Commission Commission, Warranty Warranty) Seed(string userStatus, string commissionStatus, string warrantyStatus)
    {
        var now = DateTime.UtcNow;
        var user = new AppUser { UserId = Guid.NewGuid(), Email = $"{Guid.NewGuid():N}@example.com", PasswordHash = "x", Status = userStatus, CreatedAt = now, UpdatedAt = now };
        var affiliate = new AffiliateProfile
        {
            AffiliateId = Guid.NewGuid(), UserId = user.UserId, User = user, AffiliateType = "INDIVIDUAL", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now,
        };
        var attribution = new Attribution
        {
            AttributionId = Guid.NewGuid(), ApplicationId = Guid.NewGuid(), AffiliateId = affiliate.AffiliateId, Affiliate = affiliate,
            WinningSubmissionId = Guid.NewGuid(), AttributionRule = "FIRST_ACCEPTED_SUBMISSION", Status = "ACTIVE", EstablishedAt = now, UpdatedAt = now,
        };
        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(), ApplicationId = attribution.ApplicationId, OfferId = Guid.NewGuid(),
            ActualStartDate = DateOnly.FromDateTime(now), Status = PlacementStates.Started, ConfirmedAt = now, CreatedAt = now, UpdatedAt = now,
        };
        var warranty = new Warranty
        {
            WarrantyId = Guid.NewGuid(), PlacementId = placement.PlacementId, StartDate = placement.ActualStartDate,
            EndDate = placement.ActualStartDate.AddDays(30), Status = warrantyStatus, CreatedAt = now, UpdatedAt = now,
        };
        placement.Warranty = warranty;
        var commission = new Commission
        {
            CommissionId = Guid.NewGuid(), AttributionId = attribution.AttributionId, Attribution = attribution, PlacementId = placement.PlacementId,
            Placement = placement, Amount = 1_000_000m, Status = commissionStatus, RuleSnapshot = "{}", CalculationSnapshot = "{}", CreatedAt = now, UpdatedAt = now,
        };
        _context.AddRange(user, affiliate, attribution, placement, warranty, commission);
        _context.SaveChanges();
        return (user, commission, warranty);
    }

    [Theory]
    [InlineData(CommissionStates.InWarranty)]
    [InlineData(CommissionStates.Pending)]
    public async Task SuspendedAffiliate_NotYetEarned_ShouldBeHeld(string status)
    {
        var (_, commission, _) = Seed("SUSPENDED", status, WarrantyStates.Active);

        var (held, _) = await Service().RunAsync();

        held.Should().Be(1);
        commission.Status.Should().Be(CommissionStates.OnHold);
    }

    [Theory]
    [InlineData(CommissionStates.Earned)]
    [InlineData(CommissionStates.Payable)]
    public async Task SuspendedAffiliate_AlreadyEarned_ShouldStillBePaid(string status)
    {
        var (_, commission, _) = Seed("SUSPENDED", status, WarrantyStates.Passed);

        await Service().RunAsync();

        commission.Status.Should().Be(status);
    }

    [Fact]
    public async Task Reactivated_WarrantyStillActive_ShouldReturnToInWarranty()
    {
        var (user, commission, _) = Seed("SUSPENDED", CommissionStates.InWarranty, WarrantyStates.Active);
        await Service().RunAsync();
        user.Status = "ACTIVE";
        _context.SaveChanges();

        var (_, released) = await Service().RunAsync();

        released.Should().Be(1);
        commission.Status.Should().Be(CommissionStates.InWarranty);
    }

    [Fact]
    public async Task Reactivated_WarrantyPassedMeanwhile_ShouldBecomeEarned()
    {
        var (user, commission, warranty) = Seed("SUSPENDED", CommissionStates.InWarranty, WarrantyStates.Active);
        await Service().RunAsync();
        warranty.Status = WarrantyStates.Passed;
        user.Status = "ACTIVE";
        _context.SaveChanges();

        await Service().RunAsync();

        commission.Status.Should().Be(CommissionStates.Earned);
    }

    [Fact]
    public async Task ResignationClaimHold_ShouldNotBeReleasedByThisWorker()
    {
        var (_, commission, _) = Seed("ACTIVE", CommissionStates.OnHold, WarrantyStates.Claimed);

        var (held, released) = await Service().RunAsync();

        (held, released).Should().Be((0, 0));
        commission.Status.Should().Be(CommissionStates.OnHold);
    }
}
