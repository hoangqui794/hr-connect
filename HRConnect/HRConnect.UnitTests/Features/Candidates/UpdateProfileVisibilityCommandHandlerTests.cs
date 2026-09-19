using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Commands.UpdateProfileVisibility;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UpdateProfileVisibilityCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<UpdateProfileVisibilityCommandHandler>> _loggerMock;
    private readonly UpdateProfileVisibilityCommandHandler _handler;

    public UpdateProfileVisibilityCommandHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<UpdateProfileVisibilityCommandHandler>>();

        _handler = new UpdateProfileVisibilityCommandHandler(
            _candidateRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    [Theory]
    [InlineData("PUBLIC", "PUBLIC")]
    [InlineData("public", "PUBLIC")]
    [InlineData("PRIVATE", "PRIVATE")]
    [InlineData("private", "PRIVATE")]
    public async Task Handle_WhenCandidateExists_ShouldUpdateVisibilityAndSave(string inputVisibility, string expectedVisibility)
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            FullName = "Nguyen Van A",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE"
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _unitOfWorkMock
            .Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        var command = new UpdateProfileVisibilityCommand
        {
            UserId = userId,
            Visibility = inputVisibility
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Message.Should().Be("Cập nhật chế độ hiển thị hồ sơ thành công.");
        result.Data.Should().NotBeNull();
        result.Data!.ProfileVisibility.Should().Be(expectedVisibility);
        result.Data.CandidateId.Should().Be(candidate.CandidateId);

        candidate.ProfileVisibility.Should().Be(expectedVisibility);

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCandidateDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var command = new UpdateProfileVisibilityCommand
        {
            UserId = userId,
            Visibility = "PUBLIC"
        };

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ ứng viên*");

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
