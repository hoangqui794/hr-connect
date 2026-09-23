using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateApplicationDetail;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Candidates;

public class GetCandidateApplicationDetailQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepoMock;
    private readonly Mock<IApplicationRepository> _applicationRepoMock;
    private readonly GetCandidateApplicationDetailQueryHandler _handler;

    public GetCandidateApplicationDetailQueryHandlerTests()
    {
        _candidateRepoMock = new Mock<ICandidateRepository>();
        _applicationRepoMock = new Mock<IApplicationRepository>();
        _handler = new GetCandidateApplicationDetailQueryHandler(
            _candidateRepoMock.Object,
            _applicationRepoMock.Object);
    }

    [Fact]
    public async Task Handle_WhenCandidateOwnsApplication_ShouldReturnApplicationDetails()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();

        var candidate = new Candidate
        {
            CandidateId = candidateId,
            UserId = userId,
            FullName = "Nguyen Van A"
        };

        var app = new JobApplication
        {
            ApplicationId = applicationId,
            CandidateId = candidateId,
            JobId = jobId,
            Status = "SUBMITTED",
            CurrentStage = "APPLICATION_RECEIVED",
            StatusReason = null,
            AppliedAt = DateTime.UtcNow.AddDays(-2),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
            Job = new Job
            {
                JobId = jobId,
                Title = "Senior .NET Developer",
                CompanyId = Guid.NewGuid(),
                Company = new Company { CompanyName = "Tech Corp" }
            },
            Submission = new Submission
            {
                CvId = cvId,
                Source = "CANDIDATE",
                CandidateCv = new CandidateCv
                {
                    CvId = cvId,
                    Title = "My .NET CV",
                    FileName = "cv.pdf"
                }
            },
            AiMatchResults = new List<AiMatchResult>
            {
                new()
                {
                    AttemptNo = 1,
                    Status = "COMPLETED",
                    MatchScore = 85.5m,
                    MatchTier = "HIGH"
                }
            }
        };

        _candidateRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _applicationRepoMock.Setup(r => r.GetByIdWithDetailsAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetCandidateApplicationDetailQuery(applicationId, userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.ApplicationId.Should().Be(applicationId);
        result.CandidateId.Should().Be(candidateId);
        result.JobId.Should().Be(jobId);
        result.JobTitle.Should().Be("Senior .NET Developer");
        result.CompanyName.Should().Be("Tech Corp");
        result.CvId.Should().Be(cvId);
        result.CvTitle.Should().Be("My .NET CV");
        result.CvFileName.Should().Be("cv.pdf");
        result.Status.Should().Be("SUBMITTED");
        result.CurrentStage.Should().Be("APPLICATION_RECEIVED");
        result.SubmissionSource.Should().Be("CANDIDATE");
        result.AiStatus.Should().Be("COMPLETED");
        result.AiMatchScore.Should().Be(85.5m);
        result.AiMatchTier.Should().Be("HIGH");
    }

    [Fact]
    public async Task Handle_WhenCandidateDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();

        _candidateRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var query = new GetCandidateApplicationDetailQuery(applicationId, userId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*hồ sơ ứng viên*");
    }

    [Fact]
    public async Task Handle_WhenApplicationDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();

        var candidate = new Candidate
        {
            CandidateId = candidateId,
            UserId = userId
        };

        _candidateRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _applicationRepoMock.Setup(r => r.GetByIdWithDetailsAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((JobApplication?)null);

        var query = new GetCandidateApplicationDetailQuery(applicationId, userId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*đơn ứng tuyển*");
    }

    [Fact]
    public async Task Handle_WhenApplicationBelongsToAnotherCandidate_ShouldThrowForbiddenException()
    {
        // Arrange
        var currentUserId = Guid.NewGuid();
        var currentCandidateId = Guid.NewGuid();
        var anotherCandidateId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();

        var candidate = new Candidate
        {
            CandidateId = currentCandidateId,
            UserId = currentUserId
        };

        var app = new JobApplication
        {
            ApplicationId = applicationId,
            CandidateId = anotherCandidateId, // Different candidate!
            JobId = Guid.NewGuid(),
            Status = "SUBMITTED"
        };

        _candidateRepoMock.Setup(r => r.GetByUserIdAsync(currentUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _applicationRepoMock.Setup(r => r.GetByIdWithDetailsAsync(applicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetCandidateApplicationDetailQuery(applicationId, currentUserId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền*");
    }
}
