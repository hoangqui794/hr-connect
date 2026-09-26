using FluentAssertions;
using HRConnect.Application.Features.Affiliates.Commands.SubmitCandidate;

namespace HRConnect.UnitTests.Features.Affiliates;

public class SubmitCandidateCommandValidatorTests
{
    private readonly SubmitCandidateCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenNeitherCvSourceIsProvided_IsInvalid()
    {
        var result = _validator.Validate(ValidCommand());

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorMessage.Contains("đúng một nguồn CV"));
    }

    [Fact]
    public void Validate_WhenBothCvSourcesAreProvided_IsInvalid()
    {
        var command = ValidCommand();
        command.CvId = Guid.NewGuid();
        command.FileStream = new MemoryStream([1]);
        command.FileName = "cv.pdf";
        command.FileSizeBytes = 1;

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorMessage.Contains("đúng một nguồn CV"));
    }

    [Fact]
    public void Validate_WhenExactlyOneCvSourceIsProvided_IsValid()
    {
        var command = ValidCommand();
        command.CvId = Guid.NewGuid();

        _validator.Validate(command).IsValid.Should().BeTrue();
    }

    private static SubmitCandidateCommand ValidCommand() => new()
    {
        JobId = Guid.NewGuid(),
        FullName = "Candidate",
        Email = "candidate@example.com"
    };
}
