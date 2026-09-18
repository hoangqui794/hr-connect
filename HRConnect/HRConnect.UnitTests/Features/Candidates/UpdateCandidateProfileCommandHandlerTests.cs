using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Commands.UpdateCandidateProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class UpdateCandidateProfileCommandHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IPhoneNormalizer> _phoneNormalizerMock;
    private readonly Mock<ILogger<UpdateCandidateProfileCommandHandler>> _loggerMock;
    private readonly UpdateCandidateProfileCommandHandler _handler;

    public UpdateCandidateProfileCommandHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _userRepositoryMock = new Mock<IUserRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _phoneNormalizerMock = new Mock<IPhoneNormalizer>();
        _loggerMock = new Mock<ILogger<UpdateCandidateProfileCommandHandler>>();

        _phoneNormalizerMock.Setup(p => p.Normalize(It.IsAny<string?>()))
            .Returns((string? phone) => phone?.Replace(" ", ""));

        _handler = new UpdateCandidateProfileCommandHandler(
            _candidateRepositoryMock.Object,
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _phoneNormalizerMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCandidateExists_ShouldUpdateProfileAndSyncUser()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            FullName = "Nguyen Van A",
            Phone = "0901234567",
            Status = "ACTIVE"
        };
        var user = new AppUser
        {
            UserId = userId,
            DisplayName = "Nguyen Van A",
            Email = "vana@example.com"
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _userRepositoryMock
            .Setup(u => u.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var command = new UpdateCandidateProfileCommand
        {
            UserId = userId,
            FullName = "Nguyen Van B",
            Phone = "0987654321",
            DateOfBirth = new DateOnly(1995, 5, 20),
            Gender = "MALE",
            CurrentAddress = "Hanoi, Vietnam",
            HighestEducation = "BACHELOR",
            YearsOfExperience = 4,
            Summary = "Experienced developer"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.FullName.Should().Be("Nguyen Van B");
        result.Data.YearsOfExperience.Should().Be(4);
        result.Data.Summary.Should().Be("Experienced developer");

        candidate.FullName.Should().Be("Nguyen Van B");
        user.DisplayName.Should().Be("Nguyen Van B");

        _candidateRepositoryMock.Verify(r => r.Update(candidate), Times.Once);
        _userRepositoryMock.Verify(u => u.Update(user), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var command = new UpdateCandidateProfileCommand
        {
            UserId = userId,
            FullName = "Nguyen Van B"
        };

        // Act
        Func<Task> act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ ứng viên*");
    }
}
