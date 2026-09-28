using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CommissionRules.Queries.GetCommissionRuleDetail;
using HRConnect.Domain.Entities;
using Moq;

namespace HRConnect.UnitTests.Features.CommissionRules;

public class GetCommissionRuleDetailQueryHandlerTests
{
    private readonly Mock<ICommissionRuleRepository> _rules = new();
    private readonly GetCommissionRuleDetailQueryHandler _handler;

    public GetCommissionRuleDetailQueryHandlerTests() => _handler = new(_rules.Object);

    [Fact]
    public async Task Handle_ReturnsFullRuleConfigurationForFe()
    {
        var ruleId = Guid.NewGuid();
        var serviceTypeId = Guid.NewGuid();
        _rules.Setup(repository => repository.GetByIdAsync(ruleId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CommissionRule
            {
                CommissionRuleId = ruleId,
                ServiceTypeId = serviceTypeId,
                Name = "HEADHUNT_COD - PROBATION_PASSED",
                MilestoneType = "PROBATION_PASSED",
                RateType = "PERCENT",
                RateValue = 8,
                WarrantyRequired = true,
                EffectiveFrom = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
                EffectiveTo = new DateTime(2027, 10, 1, 0, 0, 0, DateTimeKind.Utc),
                IsActive = true,
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                UpdatedAt = DateTime.UtcNow,
                ServiceType = new ServiceType { ServiceTypeId = serviceTypeId, Code = "HEADHUNT_COD", Name = "Headhunt COD" },
                MilestoneTypeNavigation = new CommissionMilestone { MilestoneCode = "PROBATION_PASSED", Name = "Qua thu viec" }
            });

        var result = await _handler.Handle(new GetCommissionRuleDetailQuery(ruleId), CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Data.CommissionRuleId.Should().Be(ruleId);
        result.Data.ServiceTypeCode.Should().Be("HEADHUNT_COD");
        result.Data.MilestoneName.Should().Be("Qua thu viec");
        result.Data.WarrantyRequired.Should().BeTrue();
        result.Data.EffectiveTo.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_ThrowsNotFoundWhenRuleDoesNotExist()
    {
        _rules.Setup(repository => repository.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CommissionRule?)null);

        var action = () => _handler.Handle(new GetCommissionRuleDetailQuery(Guid.NewGuid()), CancellationToken.None);

        await action.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Không tìm thấy quy tắc hoa hồng.");
    }
}
