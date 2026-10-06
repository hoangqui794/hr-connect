using FluentAssertions;
using HRConnect.Application.Features.InternalHr.Commands.UpdateInternalHrProfile;
using Xunit;

namespace HRConnect.UnitTests.Features.InternalHr;

public class UpdateInternalHrProfileCommandValidatorTests
{
    private readonly UpdateInternalHrProfileCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenAllFieldsValid_ShouldNotHaveValidationErrors()
    {
        var command = new UpdateInternalHrProfileCommand
        {
            DisplayName = "Trần Thị Thu Hà",
            Phone = "0912345678",
            Department = "Phòng Tuyển Dụng IT",
            JobTitle = "Talent Acquisition Lead"
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
        var command = new UpdateInternalHrProfileCommand
        {
            DisplayName = name!
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateInternalHrProfileCommand.DisplayName));
    }

    [Fact]
    public void Validate_WhenDisplayNameTooShort_ShouldHaveValidationError()
    {
        var command = new UpdateInternalHrProfileCommand
        {
            DisplayName = "A"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateInternalHrProfileCommand.DisplayName)
            && e.ErrorMessage.Contains("tối thiểu 2 ký tự"));
    }

    [Fact]
    public void Validate_WhenDisplayNameExceeds180Chars_ShouldHaveValidationError()
    {
        var command = new UpdateInternalHrProfileCommand
        {
            DisplayName = new string('A', 181)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateInternalHrProfileCommand.DisplayName)
            && e.ErrorMessage.Contains("vượt quá 180 ký tự"));
    }

    [Fact]
    public void Validate_WhenPhoneInvalidFormat_ShouldHaveValidationError()
    {
        var command = new UpdateInternalHrProfileCommand
        {
            DisplayName = "Hợp Lệ",
            Phone = "abc-xyz"
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateInternalHrProfileCommand.Phone));
    }

    [Fact]
    public void Validate_WhenDepartmentExceeds120Chars_ShouldHaveValidationError()
    {
        var command = new UpdateInternalHrProfileCommand
        {
            DisplayName = "Hợp Lệ",
            Department = new string('D', 121)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateInternalHrProfileCommand.Department));
    }

    [Fact]
    public void Validate_WhenJobTitleExceeds120Chars_ShouldHaveValidationError()
    {
        var command = new UpdateInternalHrProfileCommand
        {
            DisplayName = "Hợp Lệ",
            JobTitle = new string('J', 121)
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateInternalHrProfileCommand.JobTitle));
    }
}
