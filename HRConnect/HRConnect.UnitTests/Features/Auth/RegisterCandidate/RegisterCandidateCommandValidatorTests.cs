using FluentAssertions;
using HRConnect.Application.Features.Auth.Commands.RegisterCandidate;

namespace HRConnect.UnitTests.Features.Auth.RegisterCandidate;

public class RegisterCandidateCommandValidatorTests
{
    private readonly RegisterCandidateCommandValidator _validator;

    public RegisterCandidateCommandValidatorTests()
    {
        _validator = new RegisterCandidateCommandValidator();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_ShouldHaveError_WhenEmailIsEmpty(string? email)
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: email!,
            Password: "Password@123",
            FullName: "Nguyen Van A"
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterCandidateCommand.Email));
    }

    [Theory]
    [InlineData("invalid-email")]
    [InlineData("user@")]
    [InlineData("@example.com")]
    public void Validate_ShouldHaveError_WhenEmailFormatIsInvalid(string invalidEmail)
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: invalidEmail,
            Password: "Password@123",
            FullName: "Nguyen Van A"
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterCandidateCommand.Email));
    }

    [Theory]
    [InlineData("Short1!")] // < 8 characters
    [InlineData("nouppercase123!")] // No uppercase
    [InlineData("NOLOWERCASE123!")] // No lowercase
    [InlineData("NoSpecialChar123")] // No special character
    [InlineData("NoDigitAtAll!@#")] // No digit
    public void Validate_ShouldHaveError_WhenPasswordIsWeak(string weakPassword)
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: "candidate@example.com",
            Password: weakPassword,
            FullName: "Nguyen Van A"
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterCandidateCommand.Password));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_ShouldHaveError_WhenFullNameIsEmpty(string? fullName)
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: "candidate@example.com",
            Password: "Password@123",
            FullName: fullName!
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterCandidateCommand.FullName));
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("012345678901")] // 12 digits
    [InlineData("0223456789")] // Invalid prefix
    public void Validate_ShouldHaveError_WhenPhoneIsInvalid(string invalidPhone)
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: "candidate@example.com",
            Password: "Password@123",
            FullName: "Nguyen Van A",
            Phone: invalidPhone
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RegisterCandidateCommand.Phone));
    }

    [Theory]
    [InlineData("0901234567")]
    [InlineData("+84912345678")]
    [InlineData("0389998888")]
    [InlineData(null)]
    [InlineData("")]
    public void Validate_ShouldBeValid_WhenDataIsCorrect(string? phone)
    {
        // Arrange
        var command = new RegisterCandidateCommand(
            Email: "valid.candidate@hrconnect.vn",
            Password: "SecurePassword@2026",
            FullName: "Nguyen Van A",
            Phone: phone
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }
}
