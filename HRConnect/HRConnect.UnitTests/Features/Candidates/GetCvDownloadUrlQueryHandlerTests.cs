using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Queries.GetCvDownloadUrl;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class GetCvDownloadUrlQueryHandlerTests
{
    private readonly Mock<ICvStorageService> _cvStorageServiceMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<ILogger<GetCvDownloadUrlQueryHandler>> _loggerMock;
    private readonly GetCvDownloadUrlQueryHandler _handler;

    public GetCvDownloadUrlQueryHandlerTests()
    {
        _cvStorageServiceMock = new Mock<ICvStorageService>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _loggerMock = new Mock<ILogger<GetCvDownloadUrlQueryHandler>>();

        _handler = new GetCvDownloadUrlQueryHandler(
            _cvStorageServiceMock.Object,
            _candidateCvRepositoryMock.Object,
            _candidateRepositoryMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCandidateOwnsCv_ReturnsDownloadUrlResponse()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var cv = new CandidateCv { CvId = cvId, CandidateId = candidateId, SourceFileUrl = "candidates/1/cvs/1.pdf" };
        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        var downloadResult = new CvDownloadUrlResult
        {
            CvId = cvId,
            DownloadUrl = "https://r2.example.com/cv.pdf?token=123",
            ExpiresAt = DateTime.UtcNow.AddMinutes(15)
        };

        _cvStorageServiceMock
            .Setup(s => s.GetCvDownloadUrlAsync(cvId, It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(downloadResult);

        var query = new GetCvDownloadUrlQuery(cvId, userId, 15);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().BeEquivalentTo(downloadResult);
    }

    [Fact]
    public async Task Handle_WhenUserDoesNotOwnCv_ThrowsForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var ownerCandidateId = Guid.NewGuid();
        var differentCandidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var cv = new CandidateCv { CvId = cvId, CandidateId = ownerCandidateId, SourceFileUrl = "key" };
        var requestingCandidate = new Candidate { CandidateId = differentCandidateId, UserId = userId };

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(requestingCandidate);

        var query = new GetCvDownloadUrlQuery(cvId, userId);

        // Act
        Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*Bạn không có quyền truy cập CV này*");
    }

    [Fact]
    public async Task Handle_WhenCvNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var cvId = Guid.NewGuid();
        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateCv?)null);

        var query = new GetCvDownloadUrlQuery(cvId);

        // Act
        Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Không tìm thấy CV với mã {cvId}*");
    }
}
