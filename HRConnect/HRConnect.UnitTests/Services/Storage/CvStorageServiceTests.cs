using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Services.Storage;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Services.Storage;

public class CvStorageServiceTests
{
    private readonly Mock<IFileStorageService> _fileStorageServiceMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<CvStorageService>> _loggerMock;
    private readonly R2Settings _settings;
    private readonly CvStorageService _service;

    public CvStorageServiceTests()
    {
        _fileStorageServiceMock = new Mock<IFileStorageService>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<CvStorageService>>();

        _settings = new R2Settings
        {
            AccountId = "ea997660e8c1f6c92b939eb22891843c",
            BucketName = "hrconnect-candidate-cvs",
            Endpoint = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com",
            MaxCvFileSizeMb = 10,
            PresignedUrlExpiryMinutes = 15
        };

        var options = Options.Create(_settings);
        _service = new CvStorageService(
            _fileStorageServiceMock.Object,
            _candidateCvRepositoryMock.Object,
            _unitOfWorkMock.Object,
            options,
            _loggerMock.Object);
    }

    [Fact]
    public async Task UploadCvPdfAsync_WithValidPdf_UploadsToR2AndSavesCandidateCvWithStableObjectKey()
    {
        // Arrange
        var candidateId = Guid.NewGuid();
        var fileName = "my-resume.pdf";
        var fileBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 }; // %PDF
        using var stream = new MemoryStream(fileBytes);
        var fileSize = (long)fileBytes.Length;

        string? capturedKey = null;
        _fileStorageServiceMock
            .Setup(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "application/pdf", It.IsAny<CancellationToken>()))
            .Callback<Stream, string, string, CancellationToken>((s, key, ct, token) => capturedKey = key)
            .ReturnsAsync((Stream s, string key, string ct, CancellationToken token) => key);

        CandidateCv? savedCv = null;
        _candidateCvRepositoryMock
            .Setup(r => r.AddAsync(It.IsAny<CandidateCv>(), It.IsAny<CancellationToken>()))
            .Callback<CandidateCv, CancellationToken>((cv, token) => savedCv = cv)
            .Returns(Task.CompletedTask);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        // Act
        var result = await _service.UploadCvPdfAsync(candidateId, stream, fileName, fileSize, "Senior Developer CV", isPrimary: true);

        // Assert
        result.Should().NotBeNull();
        result.CandidateId.Should().Be(candidateId);
        result.FileName.Should().Be(fileName);
        result.MimeType.Should().Be("application/pdf");
        result.FileSizeBytes.Should().Be(fileSize);
        result.IsPrimary.Should().BeTrue();
        result.Status.Should().Be("ACTIVE");

        // Verify object key format: candidates/{candidateId}/cvs/{cvId}.pdf
        capturedKey.Should().NotBeNull();
        capturedKey.Should().StartWith($"candidates/{candidateId}/cvs/");
        capturedKey.Should().EndWith(".pdf");
        result.ObjectKey.Should().Be(capturedKey);

        // Verify CandidateCv entity saved in database
        savedCv.Should().NotBeNull();
        savedCv!.CandidateId.Should().Be(candidateId);
        savedCv.CreationMethod.Should().Be("FILE_UPLOAD");
        savedCv.SourceFileUrl.Should().Be(capturedKey); // Semantic field storing the stable object key
        savedCv.FileName.Should().Be(fileName);
        savedCv.MimeType.Should().Be("application/pdf");
        savedCv.FileSizeBytes.Should().Be(fileSize);
        savedCv.IsPrimary.Should().BeTrue();
        savedCv.Status.Should().Be("ACTIVE");

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("document.docx")]
    [InlineData("image.png")]
    [InlineData("cv.exe")]
    [InlineData("noextension")]
    public async Task UploadCvPdfAsync_WhenNonPdfExtension_ThrowsBadRequestException(string invalidFileName)
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });

        // Act
        Func<Task> act = async () => await _service.UploadCvPdfAsync(Guid.NewGuid(), stream, invalidFileName, 100);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Chỉ cho phép tải lên tập tin có định dạng PDF*");
    }

    [Fact]
    public async Task UploadCvPdfAsync_WhenFileSizeExceedsLimit_ThrowsBadRequestException()
    {
        // Arrange
        using var stream = new MemoryStream(new byte[] { 1 });
        var oversizedBytes = (long)(_settings.MaxCvFileSizeMb + 1) * 1024 * 1024;

        // Act
        Func<Task> act = async () => await _service.UploadCvPdfAsync(Guid.NewGuid(), stream, "large.pdf", oversizedBytes);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*vượt quá giới hạn tối đa*");
    }

    [Fact]
    public async Task UploadCvPdfAsync_WhenStreamEmptyOrNull_ThrowsBadRequestException()
    {
        // Act
        Func<Task> act = async () => await _service.UploadCvPdfAsync(Guid.NewGuid(), Stream.Null, "empty.pdf", 0);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Tập tin tải lên không được rỗng*");
    }

    [Fact]
    public async Task UploadCvPdfAsync_WhenDatabaseSaveFails_ExecutesCompensationDeleteOnR2()
    {
        // Arrange
        var candidateId = Guid.NewGuid();
        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        string? uploadedKey = null;

        _fileStorageServiceMock
            .Setup(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "application/pdf", It.IsAny<CancellationToken>()))
            .Callback<Stream, string, string, CancellationToken>((s, key, ct, token) => uploadedKey = key)
            .ReturnsAsync((Stream s, string key, string ct, CancellationToken token) => key);

        // Simulate DB failure
        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Database connection lost"));

        // Act
        Func<Task> act = async () => await _service.UploadCvPdfAsync(candidateId, stream, "test.pdf", 100);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Không thể lưu thông tin hồ sơ CV vào cơ sở dữ liệu*");

        // Verify compensation deletion was triggered on R2 with the exact uploaded key
        uploadedKey.Should().NotBeNull();
        _fileStorageServiceMock.Verify(s => s.DeleteAsync(uploadedKey!, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetCvDownloadUrlAsync_WhenCvExists_ReturnsPresignedUrlWithExpiry()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var objectKey = $"candidates/{candidateId}/cvs/{cvId}.pdf";
        var expectedPresignedUrl = "https://ea997660e8c1f6c92b939eb22891843c.r2.cloudflarestorage.com/hrconnect-candidate-cvs/test?X-Amz-Signature=xyz";

        var cv = new CandidateCv
        {
            CvId = cvId,
            CandidateId = candidateId,
            Title = "Test CV",
            SourceFileUrl = objectKey,
            Status = "ACTIVE"
        };

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _fileStorageServiceMock
            .Setup(s => s.GetPresignedDownloadUrlAsync(objectKey, TimeSpan.FromMinutes(15), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedPresignedUrl);

        // Act
        var result = await _service.GetCvDownloadUrlAsync(cvId, TimeSpan.FromMinutes(15));

        // Assert
        result.Should().NotBeNull();
        result.CvId.Should().Be(cvId);
        result.DownloadUrl.Should().Be(expectedPresignedUrl);
        result.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task GetCvDownloadUrlAsync_WhenCvNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateCv?)null);

        // Act
        Func<Task> act = async () => await _service.GetCvDownloadUrlAsync(cvId);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Không tìm thấy CV với mã {cvId}*");
    }

    [Fact]
    public async Task DeleteCvAsync_WhenCvExists_DeletesDatabaseBeforeR2()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var objectKey = $"candidates/123/cvs/{cvId}.pdf";
        var cv = new CandidateCv
        {
            CvId = cvId,
            SourceFileUrl = objectKey,
            Status = "ACTIVE"
        };

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        var sequence = new MockSequence();
        _unitOfWorkMock.InSequence(sequence)
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);
        _fileStorageServiceMock.InSequence(sequence)
            .Setup(s => s.DeleteAsync(objectKey, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        await _service.DeleteCvAsync(cvId);

        // Assert
        _fileStorageServiceMock.Verify(s => s.DeleteAsync(objectKey, It.IsAny<CancellationToken>()), Times.Once);
        _candidateCvRepositoryMock.Verify(r => r.Delete(cv), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteCvAsync_WhenDatabaseDeleteFails_DoesNotDeleteR2Object()
    {
        var cvId = Guid.NewGuid();
        var objectKey = $"candidates/123/cvs/{cvId}.pdf";
        var cv = new CandidateCv { CvId = cvId, SourceFileUrl = objectKey, Status = "ACTIVE" };
        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);
        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("foreign key conflict"));

        var action = () => _service.DeleteCvAsync(cvId);

        await action.Should().ThrowAsync<InvalidOperationException>();
        _candidateCvRepositoryMock.Verify(r => r.Delete(cv), Times.Once);
        _fileStorageServiceMock.Verify(s => s.DeleteAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeleteCvAsync_WhenR2CleanupFails_KeepsSuccessfulDatabaseDelete()
    {
        var cvId = Guid.NewGuid();
        var objectKey = $"candidates/123/cvs/{cvId}.pdf";
        var cv = new CandidateCv { CvId = cvId, SourceFileUrl = objectKey, Status = "ACTIVE" };
        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);
        _fileStorageServiceMock
            .Setup(s => s.DeleteAsync(objectKey, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("R2 unavailable"));

        var action = () => _service.DeleteCvAsync(cvId);

        await action.Should().NotThrowAsync();
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _fileStorageServiceMock.Verify(s => s.DeleteAsync(objectKey, It.IsAny<CancellationToken>()), Times.Once);
    }
}
