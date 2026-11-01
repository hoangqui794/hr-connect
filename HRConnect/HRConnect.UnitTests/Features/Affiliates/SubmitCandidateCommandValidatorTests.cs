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

    [Fact]
    public void Validate_WhenReusingCandidateFromLibrary_IsValidWithoutIdentityFields()
    {
        var command = new SubmitCandidateCommand
        {
            JobId = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            CvId = Guid.NewGuid()
        };

        _validator.Validate(command).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WhenLibraryReuseAlsoUploadsFile_IsInvalid()
    {
        var command = new SubmitCandidateCommand
        {
            JobId = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            CvId = Guid.NewGuid(),
            FileStream = new MemoryStream([1]),
            FileName = "cv.pdf",
            FileSizeBytes = 1
        };

        _validator.Validate(command).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("0122010010")]
    [InlineData("01227569597")]
    [InlineData("0223456789")]
    public void Validate_WhenPhoneIsNotACurrentVietnameseMobileNumber_IsInvalid(string phone)
    {
        var command = ValidCommand();
        command.CvId = Guid.NewGuid();
        command.Phone = phone;

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.PropertyName == nameof(SubmitCandidateCommand.Phone));
    }

    [Theory]
    [InlineData("0777569597")]
    [InlineData("0522345678")]
    [InlineData("0552345678")]
    [InlineData("+84912345678")]
    [InlineData("0912 345 678")]
    public void Validate_WhenPhoneIsACurrentVietnameseMobileNumber_IsValid(string phone)
    {
        var command = ValidCommand();
        command.CvId = Guid.NewGuid();
        command.Phone = phone;

        _validator.Validate(command).IsValid.Should().BeTrue();
    }

    private static SubmitCandidateCommand ValidCommand() => new()
    {
        JobId = Guid.NewGuid(),
        FullName = "Candidate",
        Email = "candidate@example.com"
    };
}
