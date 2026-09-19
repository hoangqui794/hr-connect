using System;
using FluentAssertions;
using FluentValidation.TestHelper;
using HRConnect.Application.Features.ServiceTypes.Commands.UpdateServiceType;
using Xunit;

namespace HRConnect.UnitTests.Features.ServiceTypes;

public class UpdateServiceTypeValidatorTests
{
    private readonly UpdateServiceTypeValidator _validator = new();

    [Fact]
    public void Validate_ShouldPass_WhenCommandIsValid()
    {
        var command = new UpdateServiceTypeCommand
        {
            Id = Guid.NewGuid(),
            Code = "HEADHUNT_COD",
            Name = "Headhunt COD",
            Description = "Updated Description",
            IsActive = true
        };

        var result = _validator.TestValidate(command);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ShouldFail_WhenIdIsEmpty()
    {
        var command = new UpdateServiceTypeCommand
        {
            Id = Guid.Empty,
            Code = "HEADHUNT_COD",
            Name = "Headhunt COD"
        };

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Id);
    }

    [Fact]
    public void Validate_ShouldFail_WhenCodeIsInvalid()
    {
        var command = new UpdateServiceTypeCommand
        {
            Id = Guid.NewGuid(),
            Code = "INVALID CODE!",
            Name = "Valid Name"
        };

        var result = _validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.Code);
    }
}
