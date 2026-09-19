using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Features.ServiceTypes.Commands.CreateServiceType;
using Xunit;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class CreateServiceTypeValidatorTests
{
    private readonly CreateServiceTypeValidator _validator = new();

    [Fact]
    public void Validate_ShouldPass_WhenCommandIsValid()
    {
        var command = new CreateServiceTypeCommand
        {
            Code = "HEADHUNT_COD",
            Name = "Headhunt COD",
            Description = "Commission-based service"
        };

        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_ShouldFail_WhenCodeIsEmpty(string? code)
    {
        var command = new CreateServiceTypeCommand
        {
            Code = code!,
            Name = "Valid Name"
        };

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Code);
    }

    [Theory]
    [InlineData("CODE WITH SPACES")]
    [InlineData("CODE-WITH-DASH")]
    [InlineData("CODE@SPECIAL!")]
    public void Validate_ShouldFail_WhenCodeHasInvalidCharacters(string code)
    {
        var command = new CreateServiceTypeCommand
        {
            Code = code,
            Name = "Valid Name"
        };

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Code);
    }

    [Fact]
    public void Validate_ShouldFail_WhenNameIsEmpty()
    {
        var command = new CreateServiceTypeCommand
        {
            Code = "VALID_CODE",
            Name = ""
        };

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }
}
