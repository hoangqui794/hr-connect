using FluentAssertions;
using HRConnect.Application.Features.Affiliates.Commands.UpdateAffiliateProfile;
using Xunit;

namespace HRConnect.UnitTests.Features.Affiliates;

public class UpdateAffiliateProfileCommandValidatorTests
{
    private readonly UpdateAffiliateProfileCommandValidator _validator;

    public UpdateAffiliateProfileCommandValidatorTests()
    {
        _validator = new UpdateAffiliateProfileCommandValidator();
    }

    [Fact]
    public void Validate_WhenAllFieldsValid_ShouldPass()
    {
        var command = new UpdateAffiliateProfileCommand
        {
            DisplayName = "Cong Ty TNHH HR Agency",
            ContactPerson = "Nguyen Van A",
            Phone = "0987654321",
            Address = "123 Le Loi, Q1, TP.HCM",
            TaxInformation = "0123456789"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenDisplayNameIsEmpty_ShouldFail(string? displayName)
    {
        var command = new UpdateAffiliateProfileCommand
        {
            DisplayName = displayName!
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "DisplayName");
    }

    [Fact]
    public void Validate_WhenDisplayNameIsTooShort_ShouldFail()
    {
        var command = new UpdateAffiliateProfileCommand
        {
            DisplayName = "A"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "DisplayName");
    }

    [Theory]
    [InlineData("123")]
    [InlineData("abc-xyz")]
    [InlineData("0123456789012345678901")] // > 20 chars
    public void Validate_WhenPhoneIsInvalid_ShouldFail(string phone)
    {
        var command = new UpdateAffiliateProfileCommand
        {
            DisplayName = "Cong Ty ABC",
            Phone = phone
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Phone");
    }
}
