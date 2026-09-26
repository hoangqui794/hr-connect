using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateCv;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UpdateCandidateCvCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IAuditLogService> _auditLogServiceMock;
    private readonly Mock<ILogger<UpdateCandidateCvCommandHandler>> _loggerMock;
    private readonly UpdateCandidateCvCommandHandler _handler;

    public UpdateCandidateCvCommandHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _auditLogServiceMock = new Mock<IAuditLogService>();
        _loggerMock = new Mock<ILogger<UpdateCandidateCvCommandHandler>>();

        _handler = new UpdateCandidateCvCommandHandler(
            _candidateRepositoryMock.Object,
            _candidateCvRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _auditLogServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCandidateOwnsCv_UpdatesTitleSuccessfully()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };
        var cv = new CandidateCv
        {
            CvId = cvId,
            CandidateId = candidateId,
            Title = "Old Title",
            Status = "ACTIVE",
            FileName = "cv.pdf",
            MimeType = "application/pdf",
            FileSizeBytes = 12345,
            IsPrimary = true,
            CreatedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow.AddDays(-5)
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        var command = new UpdateCandidateCvCommand
        {
            CvId = cvId,
            UserId = userId,
            Title = "  Backend CV 2026  "
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.Title.Should().Be("Backend CV 2026");
        cv.Title.Should().Be("Backend CV 2026");

        _candidateCvRepositoryMock.Verify(r => r.Update(cv), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _auditLogServiceMock.Verify(a => a.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.CvUpdated && entry.EntityId == cvId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCvBelongsToAnotherCandidate_ThrowsForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var otherCandidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };
        var cv = new CandidateCv
        {
            CvId = cvId,
            CandidateId = otherCandidateId,
            Title = "Other's CV",
            Status = "ACTIVE"
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        var command = new UpdateCandidateCvCommand
        {
            CvId = cvId,
            UserId = userId,
            Title = "New Title"
        };

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền chỉnh sửa*");
    }

    [Fact]
    public async Task Handle_WhenCvNotFoundOrInactive_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateCv?)null);

        var command = new UpdateCandidateCvCommand
        {
            CvId = cvId,
            UserId = userId,
            Title = "New Title"
        };

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Không tìm thấy CV với mã {cvId}*");
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var command = new UpdateCandidateCvCommand
        {
            CvId = Guid.NewGuid(),
            UserId = userId,
            Title = "New Title"
        };

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin ứng viên*");
    }
}
