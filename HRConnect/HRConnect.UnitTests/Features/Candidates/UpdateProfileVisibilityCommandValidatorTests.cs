using FluentAssertions;
using HRConnect.Application.Features.Candidates.Commands.UpdateProfileVisibility;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UpdateProfileVisibilityCommandValidatorTests
{
    private readonly UpdateProfileVisibilityCommandValidator _validator;

    public UpdateProfileVisibilityCommandValidatorTests()
    {
        _validator = new UpdateProfileVisibilityCommandValidator();
    }

    [Theory]
    [InlineData("PUBLIC")]
    [InlineData("PRIVATE")]
    [InlineData("public")]
    [InlineData("private")]
    [InlineData(" PUBLIC ")]
    [InlineData(" PRIVATE ")]
    public void Validate_WhenVisibilityIsValid_ShouldPass(string visibility)
    {
        var command = new UpdateProfileVisibilityCommand
        {
            Visibility = visibility
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("HIDDEN")]
    [InlineData("SECRET")]
    [InlineData("123")]
    public void Validate_WhenVisibilityIsInvalid_ShouldFail(string? visibility)
    {
        var command = new UpdateProfileVisibilityCommand
        {
            Visibility = visibility!
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Visibility");
    }
}
