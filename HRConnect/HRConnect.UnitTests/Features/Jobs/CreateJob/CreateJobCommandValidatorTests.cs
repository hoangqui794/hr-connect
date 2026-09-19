using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Features.Jobs.Commands.CreateJob;

namespace HRConnect.UnitTests.Features.Jobs.CreateJob;

public class CreateJobCommandValidatorTests
{
    private readonly CreateJobCommandValidator _validator = new();

    [Fact]
    public async Task Validate_ShouldAllowIncompleteDraft_WhenCoreReferencesAreValid()
    {
        var command = new CreateJobCommand
        {
            ServiceTypeId = Guid.NewGuid()
        };

        var result = await _validator.TestValidateAsync(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_ShouldRejectEmptyServiceTypeId()
    {
        var command = new CreateJobCommand();

        var result = await _validator.TestValidateAsync(command);

        result.ShouldHaveValidationErrorFor(x => x.ServiceTypeId);
    }

    [Fact]
    public async Task Validate_ShouldRejectSalaryMaxBelowSalaryMin()
    {
        var command = new CreateJobCommand
        {
            ServiceTypeId = Guid.NewGuid(),
            SalaryMin = 20_000_000,
            SalaryMax = 10_000_000
        };

        var result = await _validator.TestValidateAsync(command);

        result.ShouldHaveValidationErrorFor(x => x.SalaryMax);
    }

    [Fact]
    public async Task Validate_ShouldRejectUnsupportedRequirementType()
    {
        var command = new CreateJobCommand
        {
            ServiceTypeId = Guid.NewGuid(),
            Requirements =
            [
                new CreateJobRequirementRequest
                {
                    RequirementType = "OPTIONAL",
                    Content = "Nice to have"
                }
            ]
        };

        var result = await _validator.TestValidateAsync(command);

        result.Errors.Should().Contain(error =>
            error.PropertyName == "Requirements[0].RequirementType");
    }
}
