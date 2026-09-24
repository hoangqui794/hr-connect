using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Commands.SetCandidatePrimaryCv;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class SetCandidatePrimaryCvCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<ICandidateCvRepository> _candidateCvRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<SetCandidatePrimaryCvCommandHandler>> _loggerMock;
    private readonly SetCandidatePrimaryCvCommandHandler _handler;

    public SetCandidatePrimaryCvCommandHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _candidateCvRepositoryMock = new Mock<ICandidateCvRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<SetCandidatePrimaryCvCommandHandler>>();

        _handler = new SetCandidatePrimaryCvCommandHandler(
            _candidateRepositoryMock.Object,
            _candidateCvRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenTargetCvIsNotPrimary_SetsTargetPrimaryAndUnsetsPreviousPrimary()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var previousPrimaryCvId = Guid.NewGuid();
        var targetCvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        var previousPrimaryCv = new CandidateCv
        {
            CvId = previousPrimaryCvId,
            CandidateId = candidateId,
            Title = "CV A (Old Primary)",
            IsPrimary = true,
            Status = "ACTIVE",
            FileName = "cva.pdf"
        };

        var targetCv = new CandidateCv
        {
            CvId = targetCvId,
            CandidateId = candidateId,
            Title = "CV B (Target)",
            IsPrimary = false,
            Status = "ACTIVE",
            FileName = "cvb.pdf"
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(targetCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(targetCv);

        _candidateCvRepositoryMock
            .Setup(r => r.GetPrimaryByCandidateIdAsync(candidateId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(previousPrimaryCv);

        var command = new SetCandidatePrimaryCvCommand
        {
            CvId = targetCvId,
            UserId = userId
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.CvId.Should().Be(targetCvId);
        result.Data.IsPrimary.Should().BeTrue();

        targetCv.IsPrimary.Should().BeTrue();
        previousPrimaryCv.IsPrimary.Should().BeFalse();

        _candidateCvRepositoryMock.Verify(r => r.Update(previousPrimaryCv), Times.Once);
        _candidateCvRepositoryMock.Verify(r => r.Update(targetCv), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task Handle_WhenTargetCvIsAlreadyPrimary_ReturnsImmediatelyWithoutUpdate()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var targetCvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };
        var targetCv = new CandidateCv
        {
            CvId = targetCvId,
            CandidateId = candidateId,
            Title = "CV B (Already Primary)",
            IsPrimary = true,
            Status = "ACTIVE",
            FileName = "cvb.pdf"
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(targetCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(targetCv);

        var command = new SetCandidatePrimaryCvCommand
        {
            CvId = targetCvId,
            UserId = userId
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Contain("hiện đã là CV chính");

        _candidateCvRepositoryMock.Verify(r => r.Update(It.IsAny<CandidateCv>()), Times.Never);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenTargetCvBelongsToAnotherCandidate_ThrowsForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var otherCandidateId = Guid.NewGuid();
        var targetCvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };
        var targetCv = new CandidateCv
        {
            CvId = targetCvId,
            CandidateId = otherCandidateId,
            Title = "Other Candidate's CV",
            IsPrimary = false,
            Status = "ACTIVE"
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(targetCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(targetCv);

        var command = new SetCandidatePrimaryCvCommand
        {
            CvId = targetCvId,
            UserId = userId
        };

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền thiết lập*");
    }

    [Fact]
    public async Task Handle_WhenTargetCvNotFoundOrInactive_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var targetCvId = Guid.NewGuid();

        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _candidateCvRepositoryMock
            .Setup(r => r.GetByIdAsync(targetCvId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CandidateCv?)null);

        var command = new SetCandidatePrimaryCvCommand
        {
            CvId = targetCvId,
            UserId = userId
        };

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage($"*Không tìm thấy CV với mã {targetCvId}*");
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var command = new SetCandidatePrimaryCvCommand
        {
            CvId = Guid.NewGuid(),
            UserId = userId
        };

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy thông tin ứng viên*");
    }
}
