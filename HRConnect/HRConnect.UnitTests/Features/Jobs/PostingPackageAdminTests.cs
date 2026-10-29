using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Jobs.PostingPackages;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Persistence.Seed;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Jobs;

public class PostingPackageAdminTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Guid _admin = Guid.NewGuid();

    private UpdatePostingPackageCommandHandler Handler() => new(new JobRepository(_context), new UnitOfWork(_context), _audit.Object);

    private async Task<Guid> PackageId(string code)
    {
        await JobPostingPackageSeeder.SeedAsync(_context);
        return (await _context.JobPostingPackages.SingleAsync(p => p.Code == code)).PackageId;
    }

    private static UpdatePostingPackageCommand Command(Guid id, Guid admin, decimal price = 1_350_000m, int days = 90, int? max = null, bool active = true) =>
        new(id, "  Gói Tiêu Chuẩn 90 ngày ", "Không giới hạn hồ sơ", price, days, max, active, admin);

    [Fact]
    public async Task Admin_edits_a_package_and_it_is_audited()
    {
        var id = await PackageId(JobPostingPackageCodes.Standard);

        var result = await Handler().Handle(Command(id, _admin), default);

        result.Name.Should().Be("Gói Tiêu Chuẩn 90 ngày");
        result.Price.Should().Be(1_350_000m);
        result.DurationDays.Should().Be(90);
        result.MaxApplications.Should().BeNull("để trống nghĩa là không giới hạn hồ sơ");
        var stored = await _context.JobPostingPackages.AsNoTracking().SingleAsync(p => p.PackageId == id);
        stored.DurationDays.Should().Be(90);
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == AuditActions.PostingPackageUpdated && e.EntityId == id && e.ActorUserId == _admin),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Restart_seeding_keeps_the_admin_values()
    {
        var id = await PackageId(JobPostingPackageCodes.Standard);
        await Handler().Handle(Command(id, _admin), default);

        await JobPostingPackageSeeder.SeedAsync(_context);

        var stored = await _context.JobPostingPackages.AsNoTracking().SingleAsync(p => p.PackageId == id);
        stored.Price.Should().Be(1_350_000m);
        stored.MaxApplications.Should().BeNull();
    }

    [Fact]
    public async Task Free_package_cannot_have_a_price()
    {
        var id = await PackageId(JobPostingPackageCodes.Free);

        await Handler().Invoking(h => h.Handle(Command(id, _admin, price: 100_000m), default))
            .Should().ThrowAsync<BadRequestException>().WithMessage("*miễn phí*");
    }

    [Theory]
    [InlineData(-1, 30, 50)]
    [InlineData(1000, 0, 50)]
    [InlineData(1000, 366, 50)]
    [InlineData(1000, 30, 0)]
    public async Task Out_of_range_numbers_are_rejected(int price, int days, int max)
    {
        var id = await PackageId(JobPostingPackageCodes.Standard);

        await Handler().Invoking(h => h.Handle(Command(id, _admin, price, days, max), default))
            .Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Unknown_package_is_not_found()
    {
        await Handler().Invoking(h => h.Handle(Command(Guid.NewGuid(), _admin), default))
            .Should().ThrowAsync<NotFoundException>();
    }
}
