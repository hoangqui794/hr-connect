using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateProfile;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Candidates;

public class GetCandidateProfileQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<ILogger<GetCandidateProfileQueryHandler>> _loggerMock;
    private readonly GetCandidateProfileQueryHandler _handler;

    public GetCandidateProfileQueryHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _loggerMock = new Mock<ILogger<GetCandidateProfileQueryHandler>>();
        _handler = new GetCandidateProfileQueryHandler(_candidateRepositoryMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCandidateExists_ShouldReturnProfileResponse()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            FullName = "Nguyen Van A",
            Email = "vana@example.com",
            Phone = "0987654321",
            ProfileVisibility = "PUBLIC",
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            CandidateSkills = new List<CandidateSkill>
            {
                new()
                {
                    SkillId = Guid.NewGuid(),
                    ProficiencyLevel = "INTERMEDIATE",
                    YearsOfExperience = 3,
                    Skill = new Skill { SkillName = "C#", Category = "BACKEND" }
                }
            }
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        var query = new GetCandidateProfileQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        result.Data!.FullName.Should().Be("Nguyen Van A");
        result.Data.Email.Should().Be("vana@example.com");
        result.Data.ProfileVisibility.Should().Be("PUBLIC");
        result.Data.Skills.Should().HaveCount(1);
        result.Data.Skills.First().SkillName.Should().Be("C#");
    }

    [Fact]
    public async Task Handle_WhenCandidateNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var query = new GetCandidateProfileQuery(userId);

        // Act
        Func<Task> act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy hồ sơ ứng viên*");
    }

    [Fact]
    public async Task Handle_WhenCandidateHasMultipleCvs_ReturnsOnlyActivePrimaryCv()
    {
        var userId = Guid.NewGuid();
        var primaryId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            FullName = "Candidate",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CandidateCvs = new List<CandidateCv>
            {
                new()
                {
                    CvId = primaryId,
                    Title = "Primary CV",
                    CreationMethod = "FILE_UPLOAD",
                    Status = "ACTIVE",
                    IsPrimary = true
                }
            }
        };
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        var result = await _handler.Handle(new GetCandidateProfileQuery(userId), CancellationToken.None);

        result.Data!.PrimaryCv.Should().NotBeNull();
        result.Data.PrimaryCv!.CvId.Should().Be(primaryId);
        result.Data.PrimaryCv.IsPrimary.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_WhenNoActivePrimaryCv_ReturnsNullPrimaryCv()
    {
        var userId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = userId,
            FullName = "Candidate",
            ProfileVisibility = "PRIVATE",
            Status = "ACTIVE",
            CandidateCvs = new List<CandidateCv>()
        };
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdWithDetailsAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        var result = await _handler.Handle(new GetCandidateProfileQuery(userId), CancellationToken.None);

        result.Data!.PrimaryCv.Should().BeNull();
    }
}
