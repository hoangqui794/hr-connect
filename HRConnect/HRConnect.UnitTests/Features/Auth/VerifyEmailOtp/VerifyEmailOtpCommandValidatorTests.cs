using FluentAssertions;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;
using Microsoft.Extensions.Options;

namespace HRConnect.UnitTests.Features.Auth.VerifyEmailOtp;

public class VerifyEmailOtpCommandValidatorTests
{
    private readonly VerifyEmailOtpCommandValidator _validator;

    public VerifyEmailOtpCommandValidatorTests()
    {
        _validator = CreateValidator(6);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_ShouldHaveError_WhenEmailIsEmpty(string? email)
    {
        // Arrange
        var command = new VerifyEmailOtpCommand(email!, "123456");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(VerifyEmailOtpCommand.Email));
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("candidate@")]
    public void Validate_ShouldHaveError_WhenEmailFormatIsInvalid(string invalidEmail)
    {
        // Arrange
        var command = new VerifyEmailOtpCommand(invalidEmail, "123456");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(VerifyEmailOtpCommand.Email));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("12345")] // 5 digits
    [InlineData("1234567")] // 7 digits
    [InlineData("12A456")] // contains non-digit
    [InlineData("abcdef")]
    public void Validate_ShouldHaveError_WhenOtpIsInvalid(string? otp)
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("candidate@example.com", otp!);

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(VerifyEmailOtpCommand.Otp));
    }

    [Fact]
    public void Validate_ShouldBeValid_WhenEmailAndOtpAreCorrect()
    {
        // Arrange
        var command = new VerifyEmailOtpCommand("candidate@example.com", "654321");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public void Validate_WhenConfiguredForEightDigits_AcceptsEightAndRejectsSix()
    {
        var validator = CreateValidator(8);

        validator.Validate(new VerifyEmailOtpCommand("candidate@example.com", "12345678"))
            .IsValid.Should().BeTrue();
        validator.Validate(new VerifyEmailOtpCommand("candidate@example.com", "123456"))
            .IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(3)]
    [InlineData(13)]
    public void Constructor_WhenOtpLengthIsUnsafe_FailsFast(int otpLength)
    {
        var action = () => CreateValidator(otpLength);

        action.Should().Throw<InvalidOperationException>()
            .WithMessage("*4 đến 12*");
    }

    private static VerifyEmailOtpCommandValidator CreateValidator(int otpLength)
    {
        return new VerifyEmailOtpCommandValidator(Options.Create(new AuthenticationSettings
        {
            Otp = new OtpSettings { Length = otpLength }
        }));
    }
}
