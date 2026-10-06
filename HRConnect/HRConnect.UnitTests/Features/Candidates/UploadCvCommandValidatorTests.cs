using FluentAssertions;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Commands.UploadCv;
using Microsoft.Extensions.Options;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UploadCvCommandValidatorTests
{
    private readonly UploadCvCommandValidator _validator;

    public UploadCvCommandValidatorTests()
    {
        var settings = new R2Settings
        {
            MaxCvFileSizeMb = 10
        };
        _validator = new UploadCvCommandValidator(Options.Create(settings));
    }

    [Fact]
    public void Validate_WithValidPdf_ShouldBeValid()
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadCvCommand
        {
            FileName = "candidate_resume.pdf",
            ContentType = "application/pdf",
            FileSizeBytes = 1024 * 1024, // 1MB
            FileStream = stream
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("cv.docx")]
    [InlineData("cv.png")]
    [InlineData("cv.txt")]
    [InlineData("cv")]
    public void Validate_WhenFileNameNotPdf_ShouldHaveValidationError(string fileName)
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1, 2 });
        var command = new UploadCvCommand
        {
            FileName = fileName,
            ContentType = "application/pdf",
            FileSizeBytes = 1024,
            FileStream = stream
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UploadCvCommand.FileName));
    }

    [Theory]
    [InlineData("application/json")]
    [InlineData("text/plain")]
    [InlineData("image/jpeg")]
    public void Validate_WhenContentTypeNotPdf_ShouldHaveValidationError(string contentType)
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1, 2 });
        var command = new UploadCvCommand
        {
            FileName = "mycv.pdf",
            ContentType = contentType,
            FileSizeBytes = 1024,
            FileStream = stream
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UploadCvCommand.ContentType));
    }

    [Fact]
    public void Validate_WhenFileSizeExceedsLimit_ShouldHaveValidationError()
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1 });
        var command = new UploadCvCommand
        {
            FileName = "cv.pdf",
            ContentType = "application/pdf",
            FileSizeBytes = 11L * 1024 * 1024, // 11MB > 10MB limit
            FileStream = stream
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UploadCvCommand.FileSizeBytes));
    }

    [Fact]
    public void Validate_WhenFileSizeZero_ShouldHaveValidationError()
    {
        // Arrange
        using var stream = new MemoryStream();
        var command = new UploadCvCommand
        {
            FileName = "cv.pdf",
            ContentType = "application/pdf",
            FileSizeBytes = 0,
            FileStream = stream
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UploadCvCommand.FileSizeBytes));
    }
}
