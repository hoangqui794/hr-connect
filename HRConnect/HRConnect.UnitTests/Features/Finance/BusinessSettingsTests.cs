using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Settings;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Finance;

public class BusinessSettingsTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Guid _admin = Guid.NewGuid();

    private BusinessSettingHandlers Handlers() =>
        new(new SystemSettingRepository(_context), new UnitOfWork(_context), Mock.Of<IAuditLogService>());

    private BusinessSettingsService Settings() => new(new SystemSettingRepository(_context));

    [Fact]
    public async Task Defaults_follow_the_business_documents()
    {
        (await Settings().GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier)).Should().Be(1.5m);
        (await Settings().GetIntAsync(BusinessSettingKeys.HeadhuntWarrantyDays)).Should().Be(30);
        (await Settings().GetIntAsync(BusinessSettingKeys.HeadhuntPaymentDueDays)).Should().Be(20);
        (await Settings().GetDecimalAsync(BusinessSettingKeys.CvSourcingAffiliateSharePercent)).Should().Be(60m);
        (await Settings().GetIntAsync(BusinessSettingKeys.Mf02ClientOwnershipDays)).Should().Be(30);
    }

    [Fact]
    public async Task Admin_override_is_used_and_listed()
    {
        await Handlers().Handle(new UpdateBusinessSettingCommand(BusinessSettingKeys.HeadhuntFeeMultiplier, 1.8m, _admin), default);

        (await Settings().GetDecimalAsync(BusinessSettingKeys.HeadhuntFeeMultiplier)).Should().Be(1.8m);
        var listed = (await Handlers().Handle(new GetBusinessSettingsQuery(), default))
            .Single(s => s.Key == BusinessSettingKeys.HeadhuntFeeMultiplier);
        listed.Value.Should().Be(1.8m);
        listed.DefaultValue.Should().Be(1.5m);
        listed.IsOverridden.Should().BeTrue();
        listed.UpdatedBy.Should().Be(_admin);
    }

    [Theory]
    [InlineData(BusinessSettingKeys.HeadhuntWarrantyDays, 0)]
    [InlineData(BusinessSettingKeys.HeadhuntWarrantyDays, 30.5)]
    [InlineData(BusinessSettingKeys.Mf02ClientOwnershipDays, 0)]
    [InlineData(BusinessSettingKeys.Mf02ClientOwnershipDays, 30.5)]
    [InlineData(BusinessSettingKeys.CvSourcingAffiliateSharePercent, 101)]
    public async Task Out_of_range_or_fractional_days_are_rejected(string key, double value)
    {
        await Handlers()
            .Invoking(h => h.Handle(new UpdateBusinessSettingCommand(key, (decimal)value, _admin), default))
            .Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Unknown_key_is_not_found()
    {
        await Handlers()
            .Invoking(h => h.Handle(new UpdateBusinessSettingCommand("mf05.unknown", 1m, _admin), default))
            .Should().ThrowAsync<NotFoundException>();
    }
}
