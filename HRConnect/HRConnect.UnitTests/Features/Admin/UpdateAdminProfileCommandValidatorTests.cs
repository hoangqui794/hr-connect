using FluentAssertions;
using HRConnect.Application.Features.Admin.Commands.UpdateAdminProfile;
using Xunit;

namespace HRConnect.UnitTests.Features.Admin;

public class UpdateAdminProfileCommandValidatorTests
{
    private readonly UpdateAdminProfileCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenAllFieldsValid_ShouldNotHaveValidationErrors()
    {
        var command = new UpdateAdminProfileCommand
        {
            DisplayName = "Nguyễn Văn Admin",
            Phone = "0901234567",
            JobTitle = "Platform Lead Administrator"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenDisplayNameIsEmpty_ShouldHaveValidationError(string? name)
    {
        var command = new UpdateAdminProfileCommand
        {
            DisplayName = name!
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateAdminProfileCommand.DisplayName));
    }

    [Fact]
    public void Validate_WhenDisplayNameTooShort_ShouldHaveValidationError()
    {
        var command = new UpdateAdminProfileCommand
        {
            DisplayName = "A"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateAdminProfileCommand.DisplayName)
            && e.ErrorMessage.Contains("tối thiểu 2 ký tự"));
    }

    [Fact]
    public void Validate_WhenDisplayNameExceeds180Chars_ShouldHaveValidationError()
    {
        var command = new UpdateAdminProfileCommand
        {
            DisplayName = new string('A', 181)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateAdminProfileCommand.DisplayName)
            && e.ErrorMessage.Contains("vượt quá 180 ký tự"));
    }

    [Fact]
    public void Validate_WhenPhoneInvalidFormat_ShouldHaveValidationError()
    {
        var command = new UpdateAdminProfileCommand
        {
            DisplayName = "Hợp Lệ",
            Phone = "invalid-phone"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateAdminProfileCommand.Phone));
    }

    [Theory]
    [InlineData("0901234567")]
    [InlineData("+84901234567")]
    [InlineData("(028) 38123456")]
    [InlineData("090-123-4567")]
    public void Validate_WhenPhoneValidFormat_ShouldNotHaveValidationError(string phone)
    {
        var command = new UpdateAdminProfileCommand
        {
            DisplayName = "Hợp Lệ",
            Phone = phone
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WhenJobTitleExceeds120Chars_ShouldHaveValidationError()
    {
        var command = new UpdateAdminProfileCommand
        {
            DisplayName = "Hợp Lệ",
            JobTitle = new string('J', 121)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateAdminProfileCommand.JobTitle));
    }
}
