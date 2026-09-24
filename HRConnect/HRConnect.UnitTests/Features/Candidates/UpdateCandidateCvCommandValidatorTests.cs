using FluentAssertions;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateCv;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UpdateCandidateCvCommandValidatorTests
{
    private readonly UpdateCandidateCvCommandValidator _validator;

    public UpdateCandidateCvCommandValidatorTests()
    {
        _validator = new UpdateCandidateCvCommandValidator();
    }

    [Fact]
    public void Validate_WhenTitleIsValid_ShouldNotHaveValidationError()
    {
        // Arrange
        var command = new UpdateCandidateCvCommand
        {
            CvId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Title = "Backend CV 2026"
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Validate_WhenTitleIsEmptyOrWhitespace_ShouldHaveValidationError(string? title)
    {
        // Arrange
        var command = new UpdateCandidateCvCommand
        {
            CvId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Title = title!
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Title");
    }

    [Fact]
    public void Validate_WhenTitleExceeds180Characters_ShouldHaveValidationError()
    {
        // Arrange
        var command = new UpdateCandidateCvCommand
        {
            CvId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            Title = new string('A', 181)
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Title" && e.ErrorMessage.Contains("180"));
    }
}
