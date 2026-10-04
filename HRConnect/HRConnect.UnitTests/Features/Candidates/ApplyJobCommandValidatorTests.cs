using FluentAssertions;
using HRConnect.Application.Features.Candidates.Commands.ApplyJob;

namespace HRConnect.UnitTests.Features.Candidates;

public sealed class ApplyJobCommandValidatorTests
{
    private readonly ApplyJobCommandValidator _validator = new();

    [Fact]
    public async Task Validate_WhenOnlyCvIdIsProvided_IsValid()
    {
        var result = await _validator.ValidateAsync(new ApplyJobCommand
        {
            JobId = Guid.NewGuid(),
            CvId = Guid.NewGuid()
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_WhenOnlyFileIsProvided_IsValid()
    {
        var result = await _validator.ValidateAsync(new ApplyJobCommand
        {
            JobId = Guid.NewGuid(),
            FileStream = new MemoryStream([1]),
            FileName = "cv.pdf",
            FileSizeBytes = 1
        });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_WhenBothCvSourcesAreProvided_IsInvalid()
    {
        var result = await _validator.ValidateAsync(new ApplyJobCommand
        {
            JobId = Guid.NewGuid(),
            CvId = Guid.NewGuid(),
            FileStream = new MemoryStream([1]),
            FileName = "cv.pdf",
            FileSizeBytes = 1
        });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(error => error.ErrorMessage.Contains("đúng một nguồn CV"));
    }

    [Fact]
    public async Task Validate_WhenNoCvSourceIsProvided_IsInvalid()
    {
        var result = await _validator.ValidateAsync(new ApplyJobCommand { JobId = Guid.NewGuid() });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(error => error.ErrorMessage.Contains("đúng một nguồn CV"));
    }
}
