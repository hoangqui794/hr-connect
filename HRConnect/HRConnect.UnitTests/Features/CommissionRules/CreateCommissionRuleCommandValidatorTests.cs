using FluentAssertions;
using HRConnect.Application.Features.CommissionRules.Commands.CreateCommissionRule;

namespace HRConnect.UnitTests.Features.CommissionRules;

public class CreateCommissionRuleCommandValidatorTests
{
    private readonly CreateCommissionRuleCommandValidator _validator = new();

    [Fact]
    public void Validate_RejectsPercentGreaterThanOneHundred()
    {
        var result = _validator.Validate(new CreateCommissionRuleCommand
        {
            ServiceTypeId = Guid.NewGuid(),
            MilestoneType = "PROBATION_PASSED",
            RateType = "PERCENT",
            RateValue = 100.01m
        });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorMessage.Contains("cannot exceed 100"));
    }

    [Fact]
    public void Validate_RejectsEffectiveRangeWithEndBeforeStart()
    {
        var result = _validator.Validate(new CreateCommissionRuleCommand
        {
            ServiceTypeId = Guid.NewGuid(),
            MilestoneType = "PROBATION_PASSED",
            RateType = "FIXED",
            RateValue = 1000000,
            EffectiveFrom = new DateTime(2026, 10, 2, 0, 0, 0, DateTimeKind.Utc),
            EffectiveTo = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc)
        });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorMessage.Contains("later than effective from"));
    }
}
