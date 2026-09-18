using FluentAssertions;
using HRConnect.Application.Features.Auth.Commands.RegisterAffiliate;

namespace HRConnect.UnitTests.Features.Auth.RegisterAffiliate;

public class RegisterAffiliateCommandValidatorTests
{
    private readonly RegisterAffiliateCommandValidator _validator;

    public RegisterAffiliateCommandValidatorTests()
    {
        _validator = new RegisterAffiliateCommandValidator();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_ShouldHaveError_WhenEmailIsEmpty(string? email)
    {
        var command = new RegisterAffiliateCommand(
            Email: email!,
            Password: "Password@123",
            FullName: "Nguyen Van A"
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterAffiliateCommand.Email));
    }

    [Theory]
    [InlineData("invalid-email")]
    [InlineData("user@")]
    [InlineData("@example.com")]
    public void Validate_ShouldHaveError_WhenEmailFormatIsInvalid(string invalidEmail)
    {
        var command = new RegisterAffiliateCommand(
            Email: invalidEmail,
            Password: "Password@123",
            FullName: "Nguyen Van A"
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterAffiliateCommand.Email));
    }

    [Theory]
    [InlineData("Short1!")]
    [InlineData("nouppercase123!")]
    [InlineData("NOLOWERCASE123!")]
    [InlineData("NoSpecialChar123")]
    [InlineData("NoDigitAtAll!@#")]
    public void Validate_ShouldHaveError_WhenPasswordIsWeak(string weakPassword)
    {
        var command = new RegisterAffiliateCommand(
            Email: "affiliate@example.com",
            Password: weakPassword,
            FullName: "Nguyen Van A"
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterAffiliateCommand.Password));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_ShouldHaveError_WhenFullNameIsEmpty(string? fullName)
    {
        var command = new RegisterAffiliateCommand(
            Email: "affiliate@example.com",
            Password: "Password@123",
            FullName: fullName!
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterAffiliateCommand.FullName));
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("012345678901")]
    [InlineData("0223456789")]
    public void Validate_ShouldHaveError_WhenPhoneIsInvalid(string invalidPhone)
    {
        var command = new RegisterAffiliateCommand(
            Email: "affiliate@example.com",
            Password: "Password@123",
            FullName: "Nguyen Van A",
            Phone: invalidPhone
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterAffiliateCommand.Phone));
    }

    [Theory]
    [InlineData("0901234567")]
    [InlineData("+84912345678")]
    [InlineData(null)]
    [InlineData("")]
    public void Validate_ShouldBeValid_WhenDataIsCorrect(string? phone)
    {
        var command = new RegisterAffiliateCommand(
            Email: "affiliate@hrconnect.vn",
            Password: "SecurePassword@2026",
            FullName: "Nguyen Van A",
            Phone: phone
        );

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }
}
