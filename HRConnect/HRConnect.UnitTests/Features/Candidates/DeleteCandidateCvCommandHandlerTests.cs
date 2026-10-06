using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Commands.DeleteCandidateCv;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class DeleteCandidateCvCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<ICvStorageService> _cvStorageServiceMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IAuditLogService> _auditLogServiceMock;
    private readonly Mock<ILogger<DeleteCandidateCvCommandHandler>> _loggerMock;
    private readonly DeleteCandidateCvCommandHandler _handler;

    public DeleteCandidateCvCommandHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _cvStorageServiceMock = new Mock<ICvStorageService>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _auditLogServiceMock = new Mock<IAuditLogService>();
        _loggerMock = new Mock<ILogger<DeleteCandidateCvCommandHandler>>();

        _handler = new DeleteCandidateCvCommandHandler(
            _candidateRepositoryMock.Object,
            _candidateCvRepositoryMock.Object,
            _cvStorageServiceMock.Object,
            _unitOfWorkMock.Object,
            _auditLogServiceMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCvNotInUse_PhysicallyDeletesViaCvStorageService()
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
            Title = "Unused CV",
            Status = "ACTIVE",
            IsPrimary = false
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _candidateCvRepositoryMock
            .Setup(r => r.IsCvInUseAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var command = new DeleteCandidateCvCommand(cvId, userId);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("thành công");

        _cvStorageServiceMock.Verify(s => s.DeleteCvAsync(cvId, It.IsAny<CancellationToken>()), Times.Once);
        _candidateCvRepositoryMock.Verify(r => r.Update(It.IsAny<CandidateCv>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenCvInUseByApplication_DeactivatesAndHidesWithoutDeletingStorage()
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
            Title = "Applied CV",
            Status = "ACTIVE",
            IsPrimary = true
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cv);

        _candidateCvRepositoryMock
            .Setup(r => r.IsCvInUseAsync(cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var command = new DeleteCandidateCvCommand(cvId, userId);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("bảo toàn");

        cv.Status.Should().Be("DELETED");
        cv.IsPrimary.Should().BeFalse();

        _candidateCvRepositoryMock.Verify(r => r.Update(cv), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cvStorageServiceMock.Verify(s => s.DeleteCvAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _auditLogServiceMock.Verify(a => a.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.CvDeleted && entry.EntityId == cvId),
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

        var command = new DeleteCandidateCvCommand(cvId, userId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền xóa*");

        _cvStorageServiceMock.Verify(s => s.DeleteCvAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
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

        var command = new DeleteCandidateCvCommand(cvId, userId);

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

        var command = new DeleteCandidateCvCommand(Guid.NewGuid(), userId);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin ứng viên*");
    }

    [Fact]
    public async Task Handle_WhenCvWasUploadedByAffiliate_ThrowsConflictWithoutDeletingOrMutatingData()
    {
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var affiliateCv = new CandidateCv
        {
            CvId = cvId,
            CandidateId = candidateId,
            Title = "Affiliate CV",
            CreationMethod = "AFFILIATE_UPLOAD",
            IsPrimary = false,
            Status = "ACTIVE"
        };

        _candidateRepositoryMock.Setup(repository => repository.GetByUserIdAsync(
                userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Candidate { CandidateId = candidateId, UserId = userId });
        _candidateCvRepositoryMock.Setup(repository => repository.GetByIdAsync(
                cvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateCv);

        var act = () => _handler.Handle(
            new DeleteCandidateCvCommand(cvId, userId), CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ConflictException>();
        exception.Which.ErrorCode.Should().Be("AFFILIATE_CV_MANAGED_SEPARATELY");
        affiliateCv.Status.Should().Be("ACTIVE");
        _candidateCvRepositoryMock.Verify(repository => repository.IsCvInUseAsync(
            It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _candidateCvRepositoryMock.Verify(repository => repository.Update(It.IsAny<CandidateCv>()), Times.Never);
        _cvStorageServiceMock.Verify(service => service.DeleteCvAsync(
            It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _auditLogServiceMock.Verify(service => service.AddAsync(
            It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWorkMock.Verify(unitOfWork => unitOfWork.SaveChangesAsync(
            It.IsAny<CancellationToken>()), Times.Never);
    }
}
