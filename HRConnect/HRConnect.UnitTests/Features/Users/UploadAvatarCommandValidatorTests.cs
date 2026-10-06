using FluentAssertions;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Users.Commands.UploadAvatar;
using Microsoft.Extensions.Options;
using Xunit;

namespace HRConnect.UnitTests.Features.Users;

public class UploadAvatarCommandValidatorTests
{
    private readonly UploadAvatarCommandValidator _validator;

    public UploadAvatarCommandValidatorTests()
    {
        var settings = new R2Settings
        {
            MaxAvatarFileSizeMb = 5
        };
        _validator = new UploadAvatarCommandValidator(Options.Create(settings));
    }

    [Theory]
    [InlineData("avatar.jpg", "image/jpeg")]
    [InlineData("profile.jpeg", "image/jpeg")]
    [InlineData("picture.png", "image/png")]
    [InlineData("photo.webp", "image/webp")]
    public void Validate_WhenValidInputs_ShouldPassValidation(string fileName, string contentType)
    {
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = Guid.NewGuid(),
            FileStream = stream,
            FileName = fileName,
            ContentType = contentType,
            FileSizeBytes = 1024 * 100 // 100 KB
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WhenUserIdEmpty_ShouldFail()
    {
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = Guid.Empty,
            FileStream = stream,
            FileName = "avatar.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 100
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UploadAvatarCommand.UserId));
    }

    [Theory]
    [InlineData("document.pdf", "application/pdf")]
    [InlineData("script.exe", "application/x-msdownload")]
    [InlineData("text.txt", "text/plain")]
    [InlineData("image.gif", "image/gif")]
    public void Validate_WhenInvalidExtensionOrContentType_ShouldFail(string fileName, string contentType)
    {
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = Guid.NewGuid(),
            FileStream = stream,
            FileName = fileName,
            ContentType = contentType,
            FileSizeBytes = 100
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_WhenFileSizeExceedsLimit_ShouldFail()
    {
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = Guid.NewGuid(),
            FileStream = stream,
            FileName = "avatar.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 6 * 1024 * 1024 // 6 MB > 5 MB
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UploadAvatarCommand.FileSizeBytes)
            && e.ErrorMessage.Contains("5MB"));
    }

    [Fact]
    public void Validate_WhenFileSizeBytesZero_ShouldFail()
    {
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var command = new UploadAvatarCommand
        {
            UserId = Guid.NewGuid(),
            FileStream = stream,
            FileName = "avatar.jpg",
            ContentType = "image/jpeg",
            FileSizeBytes = 0
        };

        var result = _validator.Validate(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UploadAvatarCommand.FileSizeBytes));
    }
}
