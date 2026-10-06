using FluentAssertions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CommissionRules.Queries.GetCommissionRules;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CommissionRules;

public class GetCommissionRulesQueryHandlerTests
{
    private readonly Mock<ICommissionRuleRepository> _rules = new();
    private readonly GetCommissionRulesQueryHandler _handler;

    public GetCommissionRulesQueryHandlerTests() => _handler = new(_rules.Object);

    [Fact]
    public async Task Handle_ReturnsRuleWithServiceTypeAndMilestoneForFe()
    {
        var serviceTypeId = Guid.NewGuid();
        var ruleId = Guid.NewGuid();
        _rules.Setup(repository => repository.GetListAsync(
                serviceTypeId, "PROBATION_PASSED", true, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<CommissionRule>
            {
                new()
                {
                    CommissionRuleId = ruleId,
                    ServiceTypeId = serviceTypeId,
                    Name = "HEADHUNT_COD - PROBATION_PASSED",
                    MilestoneType = "PROBATION_PASSED",
                    RateType = "PERCENT",
                    RateValue = 8,
                    WarrantyRequired = false,
                    EffectiveFrom = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow.AddDays(-1),
                    UpdatedAt = DateTime.UtcNow,
                    ServiceType = new ServiceType { ServiceTypeId = serviceTypeId, Code = "HEADHUNT_COD", Name = "Headhunt COD" },
                    MilestoneTypeNavigation = new CommissionMilestone { MilestoneCode = "PROBATION_PASSED", Name = "Probation Passed" }
                }
            }, 1));

        var result = await _handler.Handle(
            new GetCommissionRulesQuery(serviceTypeId, "PROBATION_PASSED", true, 1, 20),
            CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.Total.Should().Be(1);
        result.Data.Items.Should().ContainSingle();
        result.Data.Items[0].CommissionRuleId.Should().Be(ruleId);
        result.Data.Items[0].ServiceTypeCode.Should().Be("HEADHUNT_COD");
        result.Data.Items[0].MilestoneName.Should().Be("Probation Passed");
        result.Data.Items[0].RateValue.Should().Be(8);
    }

    [Fact]
    public async Task Handle_NormalizesPagingBeforeCallingRepository()
    {
        _rules.Setup(repository => repository.GetListAsync(
                null, null, null, 1, 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Array.Empty<CommissionRule>(), 0));

        var result = await _handler.Handle(new GetCommissionRulesQuery(null, null, null, 0, 999), CancellationToken.None);

        result.Data.Page.Should().Be(1);
        result.Data.PageSize.Should().Be(100);
        result.Data.TotalPages.Should().Be(0);
    }
}
