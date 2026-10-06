using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using FluentAssertions;
using HRConnect.Application.Common.Models;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Services.Storage;

public class CloudflareR2StorageServiceTests
{
    private readonly Mock<IAmazonS3> _s3Mock;
    private readonly Mock<ILogger<CloudflareR2StorageService>> _loggerMock;
    private readonly R2Settings _settings;
    private readonly CloudflareR2StorageService _service;

    public CloudflareR2StorageServiceTests()
    {
        _s3Mock = new Mock<IAmazonS3>();
        _loggerMock = new Mock<ILogger<CloudflareR2StorageService>>();
        _settings = new R2Settings
        {
            AccountId = "ea997660e8c1f6c92b939eb22891843c",
            BucketName = "hrconnect-candidate-cvs",
            Endpoint = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com",
            AccessKeyId = "test-access-key",
            SecretAccessKey = "test-secret-key-that-must-not-leak"
        };

        var options = Options.Create(_settings);
        _service = new CloudflareR2StorageService(_s3Mock.Object, options, _loggerMock.Object);
    }

    [Fact]
    public async Task UploadAsync_WithValidStream_CallsPutObjectWithCorrectBucketKeyAndContentType()
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        var objectKey = "candidates/123/cvs/abc.pdf";
        var contentType = "application/pdf";

        _s3Mock.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PutObjectResponse { HttpStatusCode = HttpStatusCode.OK });

        // Act
        var result = await _service.UploadAsync(stream, objectKey, contentType);

        // Assert
        result.Should().Be(objectKey);
        _s3Mock.Verify(s => s.PutObjectAsync(It.Is<PutObjectRequest>(r =>
            r.BucketName == _settings.BucketName &&
            r.Key == objectKey &&
            r.ContentType == contentType &&
            r.DisablePayloadSigning == true), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UploadAsync_WithNullStream_ThrowsArgumentException()
    {
        // Act
        Func<Task> act = async () => await _service.UploadAsync(null!, "some-key", "application/pdf");

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Dữ liệu tải lên không được rỗng*");
    }

    [Fact]
    public async Task UploadAsync_WithEmptyKey_ThrowsArgumentException()
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });

        // Act
        Func<Task> act = async () => await _service.UploadAsync(stream, "", "application/pdf");

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Mã khóa đối tượng*không được để trống*");
    }

    [Fact]
    public async Task UploadAsync_WhenMissingBucketConfig_ThrowsInvalidOperationException()
    {
        // Arrange
        var invalidSettings = new R2Settings { BucketName = "" };
        var service = new CloudflareR2StorageService(_s3Mock.Object, Options.Create(invalidSettings), _loggerMock.Object);
        using var stream = new MemoryStream(new byte[] { 1, 2 });

        // Act
        Func<Task> act = async () => await service.UploadAsync(stream, "key", "application/pdf");

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*R2_BUCKET_NAME chưa được thiết lập*");
    }

    [Fact]
    public async Task UploadAsync_WhenS3ThrowsException_CatchesAndThrowsWithoutLeakingSecrets()
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        _s3Mock.Setup(s => s.PutObjectAsync(It.IsAny<PutObjectRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("Access Denied") { StatusCode = HttpStatusCode.Forbidden, ErrorCode = "AccessDenied" });

        // Act
        Func<Task> act = async () => await _service.UploadAsync(stream, "test-key", "application/pdf");

        // Assert
        var exception = await act.Should().ThrowAsync<InvalidOperationException>();
        exception.Which.Message.Should().NotContain(_settings.SecretAccessKey);
    }

    [Fact]
    public async Task DeleteAsync_CallsDeleteObjectWithCorrectBucketAndKey()
    {
        // Arrange
        var objectKey = "candidates/123/cvs/abc.pdf";
        _s3Mock.Setup(s => s.DeleteObjectAsync(It.IsAny<DeleteObjectRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DeleteObjectResponse { HttpStatusCode = HttpStatusCode.NoContent });

        // Act
        await _service.DeleteAsync(objectKey);

        // Assert
        _s3Mock.Verify(s => s.DeleteObjectAsync(It.Is<DeleteObjectRequest>(r =>
            r.BucketName == _settings.BucketName &&
            r.Key == objectKey), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_WhenEmptyKey_DoesNotCallS3()
    {
        // Act
        await _service.DeleteAsync("");

        // Assert
        _s3Mock.Verify(s => s.DeleteObjectAsync(It.IsAny<DeleteObjectRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetPresignedDownloadUrlAsync_CallsGetPreSignedURLWithCorrectBucketKeyAndExpiry()
    {
        // Arrange
        var objectKey = "candidates/123/cvs/abc.pdf";
        var expiry = TimeSpan.FromMinutes(15);
        var expectedUrl = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com/hrconnect-candidate-cvs/candidates/123/cvs/abc.pdf?X-Amz-Signature=xyz";

        _s3Mock.Setup(s => s.GetPreSignedURL(It.Is<GetPreSignedUrlRequest>(r =>
            r.BucketName == _settings.BucketName &&
            r.Key == objectKey &&
            r.Verb == HttpVerb.GET)))
            .Returns(expectedUrl);

        // Act
        var url = await _service.GetPresignedDownloadUrlAsync(objectKey, expiry);

        // Assert
        url.Should().Be(expectedUrl);
    }

    [Fact]
    public async Task ExistsAsync_WhenObjectExists_ReturnsTrue()
    {
        // Arrange
        var objectKey = "candidates/123/cvs/abc.pdf";
        _s3Mock.Setup(s => s.GetObjectMetadataAsync(It.Is<GetObjectMetadataRequest>(r =>
            r.BucketName == _settings.BucketName && r.Key == objectKey), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetObjectMetadataResponse());

        // Act
        var exists = await _service.ExistsAsync(objectKey);

        // Assert
        exists.Should().BeTrue();
    }

    [Fact]
    public async Task ExistsAsync_WhenObjectNotFound_ReturnsFalse()
    {
        // Arrange
        var objectKey = "candidates/123/cvs/missing.pdf";
        _s3Mock.Setup(s => s.GetObjectMetadataAsync(It.IsAny<GetObjectMetadataRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AmazonS3Exception("Not Found") { StatusCode = HttpStatusCode.NotFound });

        // Act
        var exists = await _service.ExistsAsync(objectKey);

        // Assert
        exists.Should().BeFalse();
    }
}
