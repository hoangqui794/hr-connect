using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Commands.UploadCv;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UploadCvCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<ICvStorageService> _cvStorageServiceMock;
    private readonly Mock<ILogger<UploadCvCommandHandler>> _loggerMock;
    private readonly UploadCvCommandHandler _handler;

    public UploadCvCommandHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _cvStorageServiceMock = new Mock<ICvStorageService>();
        _loggerMock = new Mock<ILogger<UploadCvCommandHandler>>();

        _handler = new UploadCvCommandHandler(
            _candidateRepositoryMock.Object,
            _cvStorageServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WithValidUserId_ResolvesCandidateAndCallsCvStorageService()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = candidateId, UserId = userId, FullName = "Test Candidate" };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        using var stream = new MemoryStream(new byte[] { 1, 2, 3 });
        var expectedResult = new UploadCvResult
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidateId,
            FileName = "resume.pdf",
            ObjectKey = $"candidates/{candidateId}/cvs/test.pdf"
        };

        _cvStorageServiceMock
            .Setup(s => s.UploadCvPdfAsync(candidateId, stream, "resume.pdf", 3, "My Resume", false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResult);

        var command = new UploadCvCommand
        {
            UserId = userId,
            FileStream = stream,
            FileName = "resume.pdf",
            ContentType = "application/pdf",
            FileSizeBytes = 3,
            Title = "My Resume"
        };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Should().NotBeNull();
        response.Success.Should().BeTrue();
        response.Data.Should().BeEquivalentTo(expectedResult);
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFoundForUserId_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var command = new UploadCvCommand
        {
            UserId = userId,
            FileStream = Stream.Null,
            FileName = "resume.pdf",
            ContentType = "application/pdf",
            FileSizeBytes = 10
        };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin ứng viên tương ứng*");
    }

    [Fact]
    public async Task Handle_WithDirectCandidateId_CallsCvStorageServiceDirectly()
    {
        // Arrange
        var candidateId = Guid.NewGuid();
        using var stream = new MemoryStream(new byte[] { 1, 2 });
        var expectedResult = new UploadCvResult
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidateId,
            FileName = "cv.pdf",
            ObjectKey = $"candidates/{candidateId}/cvs/test.pdf"
        };

        _cvStorageServiceMock
            .Setup(s => s.UploadCvPdfAsync(candidateId, stream, "cv.pdf", 2, null, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResult);

        var command = new UploadCvCommand
        {
            CandidateId = candidateId,
            FileStream = stream,
            FileName = "cv.pdf",
            ContentType = "application/pdf",
            FileSizeBytes = 2,
            IsPrimary = true
        };

        // Act
        var response = await _handler.Handle(command, CancellationToken.None);

        // Assert
        response.Success.Should().BeTrue();
        _candidateRepositoryMock.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _cvStorageServiceMock.Verify(s => s.UploadCvPdfAsync(candidateId, stream, "cv.pdf", 2, null, true, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithoutCandidateIdOrUserId_ThrowsBadRequestException()
    {
        // Arrange
        var command = new UploadCvCommand
        {
            FileStream = Stream.Null,
            FileName = "cv.pdf",
            ContentType = "application/pdf",
            FileSizeBytes = 2
        };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<BadRequestException>()
            .WithMessage("*Thiếu thông tin nhận diện ứng viên*");
    }
}
