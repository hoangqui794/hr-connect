using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Internal.Queries.GetInternalCvDownloadUrl;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Internal;

public class GetInternalCvDownloadUrlQueryHandlerTests
{
    private readonly Mock<ICvStorageService> _cvStorageServiceMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<ILogger<GetInternalCvDownloadUrlQueryHandler>> _loggerMock;
    private readonly GetInternalCvDownloadUrlQueryHandler _handler;

    public GetInternalCvDownloadUrlQueryHandlerTests()
    {
        _cvStorageServiceMock = new Mock<ICvStorageService>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _loggerMock = new Mock<ILogger<GetInternalCvDownloadUrlQueryHandler>>();

        _handler = new GetInternalCvDownloadUrlQueryHandler(
            _cvStorageServiceMock.Object,
            _candidateCvRepositoryMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCvExists_ReturnsDownloadUrlResponseWithMetadata()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cv = new CandidateCv
        {
            CvId = cvId,
            CandidateId = candidateId,
            FileName = "my_cv.pdf",
            MimeType = "application/pdf",
            SourceFileUrl = "candidates/123/cvs/1.pdf"
        };

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        var downloadResult = new CvDownloadUrlResult
        {
            CvId = cvId,
            FileName = "my_cv.pdf",
            MimeType = "application/pdf",
            DownloadUrl = "https://r2.example.com/candidates/123/cvs/1.pdf?token=secret",
            ExpiresAt = DateTime.UtcNow.AddMinutes(15)
        };

        _cvStorageServiceMock
            .Setup(s => s.GetCvDownloadUrlAsync(cvId, It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(downloadResult);

        var query = new GetInternalCvDownloadUrlQuery(cvId);

        // Act
        var response = await _handler.Handle(query, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Data.Should().NotBeNull();
        response.Data!.CvId.Should().Be(cvId);
        response.Data.FileName.Should().Be("my_cv.pdf");
        response.Data.MimeType.Should().Be("application/pdf");
        response.Data.DownloadUrl.Should().Be(downloadResult.DownloadUrl);
        response.Data.ExpiresAt.Should().Be(downloadResult.ExpiresAt);
    }

    [Fact]
    public async Task Handle_WhenCvDoesNotExist_ThrowsNotFoundException()
    {
        // Arrange
        var cvId = Guid.NewGuid();

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateCv?)null);

        var query = new GetInternalCvDownloadUrlQuery(cvId);

        // Act
        Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*{cvId}*");
    }

    [Fact]
    public async Task Handle_WhenCustomExpiryProvided_PassesCustomExpiryToStorageService()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        var cv = new CandidateCv
        {
            CvId = cvId,
            CandidateId = Guid.NewGuid(),
            FileName = "resume.pdf",
            SourceFileUrl = "candidates/123/cvs/1.pdf"
        };

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        TimeSpan? capturedExpiry = null;
        _cvStorageServiceMock
            .Setup(s => s.GetCvDownloadUrlAsync(cvId, It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>()))
            .Callback<Guid, TimeSpan?, CancellationToken>((_, exp, _) => capturedExpiry = exp)
            .ReturnsAsync(new CvDownloadUrlResult { CvId = cvId, DownloadUrl = "https://r2.example.com" });

        var query = new GetInternalCvDownloadUrlQuery(cvId, expiryMinutes: 30);

        // Act
        await _handler.Handle(query, CancellationToken.None);

        // Assert
        capturedExpiry.Should().NotBeNull();
        capturedExpiry!.Value.TotalMinutes.Should().Be(30);
    }
}
