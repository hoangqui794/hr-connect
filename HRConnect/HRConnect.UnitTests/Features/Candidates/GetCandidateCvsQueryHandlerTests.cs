using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class GetCandidateCvsQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<ILogger<GetCandidateCvsQueryHandler>> _loggerMock;
    private readonly GetCandidateCvsQueryHandler _handler;

    public GetCandidateCvsQueryHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _loggerMock = new Mock<ILogger<GetCandidateCvsQueryHandler>>();

        _handler = new GetCandidateCvsQueryHandler(
            _candidateRepositoryMock.Object,
            _candidateCvRepositoryMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCandidateExists_ReturnsOwnCvList()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        var cv1 = new CandidateCv
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidateId,
            Title = "CV Backend Senior",
            FileName = "cv-backend.pdf",
            MimeType = "application/pdf",
            FileSizeBytes = 102400,
            IsPrimary = true,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow
        };

        var cv2 = new CandidateCv
        {
            CvId = Guid.NewGuid(),
            CandidateId = candidateId,
            Title = "CV Frontend",
            FileName = "cv-frontend.pdf",
            MimeType = "application/pdf",
            FileSizeBytes = 204800,
            IsPrimary = false,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByCandidateIdAsync(candidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CandidateCv> { cv1, cv2 });

        var query = new GetCandidateCvsQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().HaveCount(2);

        var first = result.Data[0];
        first.CvId.Should().Be(cv1.CvId);
        first.Title.Should().Be("CV Backend Senior");
        first.FileName.Should().Be("cv-backend.pdf");
        first.IsPrimary.Should().BeTrue();
        first.Status.Should().Be("ACTIVE");

        var second = result.Data[1];
        second.CvId.Should().Be(cv2.CvId);
        second.Title.Should().Be("CV Frontend");
        second.IsPrimary.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var query = new GetCandidateCvsQuery(userId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin ứng viên*");
    }

    [Fact]
    public async Task Handle_WhenCandidateHasNoCvs_ReturnsEmptyList()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByCandidateIdAsync(candidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<CandidateCv>());

        var query = new GetCandidateCvsQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().BeEmpty();
    }
}
