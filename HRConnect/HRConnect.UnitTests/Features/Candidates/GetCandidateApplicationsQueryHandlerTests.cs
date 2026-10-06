using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateApplications;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Candidates;

public class GetCandidateApplicationsQueryHandlerTests
{
    private readonly Mock<ICandidateRepository> _candidateRepositoryMock;
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock;
    private readonly Mock<ILogger<GetCandidateApplicationsQueryHandler>> _loggerMock;
    private readonly GetCandidateApplicationsQueryHandler _handler;

    public GetCandidateApplicationsQueryHandlerTests()
    {
        _candidateRepositoryMock = new Mock<ICandidateRepository>();
        _applicationRepositoryMock = new Mock<IApplicationRepository>();
        _loggerMock = new Mock<ILogger<GetCandidateApplicationsQueryHandler>>();

        _handler = new GetCandidateApplicationsQueryHandler(
            _candidateRepositoryMock.Object,
            _applicationRepositoryMock.Object,
            _loggerMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnApplications_WhenCandidateExists()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var candidate = new Candidate
        {
            CandidateId = candidateId,
            UserId = userId,
            FullName = "Nguyễn Văn A"
        };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var company = new Company { CompanyName = "Tech Corp" };
        var job = new Job { JobId = jobId, Title = "Senior .NET Developer", Company = company };
        var candidateCv = new CandidateCv { CvId = cvId, Title = "My CV 2026.pdf" };
        var submission = new Submission { CvId = cvId, CandidateCv = candidateCv };
        var aiMatch = new AiMatchResult { AttemptNo = 1, Status = "COMPLETED" };

        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            CandidateId = candidateId,
            JobId = jobId,
            Job = job,
            Submission = submission,
            Status = "SUBMITTED",
            AppliedAt = DateTime.UtcNow.AddDays(-2),
            AiMatchResults = new List<AiMatchResult> { aiMatch }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetCandidateApplicationsAsync(
                candidateId, null, null, null, null, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([application], 1));

        var query = new GetCandidateApplicationsQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Items.Should().HaveCount(1);
        result.Data.Total.Should().Be(1);

        var item = result.Data.Items.First();
        item.ApplicationId.Should().Be(application.ApplicationId);
        item.JobId.Should().Be(jobId);
        item.JobTitle.Should().Be("Senior .NET Developer");
        item.CompanyName.Should().Be("Tech Corp");
        item.CvId.Should().Be(cvId);
        item.CvTitle.Should().Be("My CV 2026.pdf");
        item.Status.Should().Be("SUBMITTED");
        item.AiStatus.Should().Be("COMPLETED");
        item.AppliedAt.Should().Be(application.AppliedAt);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFoundException_WhenCandidateProfileDoesNotExist()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Candidate?)null);

        var query = new GetCandidateApplicationsQuery(userId);

        // Act
        var act = () => _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Không tìm thấy thông tin hồ sơ ứng viên.");
    }

    [Fact]
    public async Task Handle_ShouldEnforceCandidateIsolation_OnlyQueriesForCurrentCandidate()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _applicationRepositoryMock
            .Setup(r => r.GetCandidateApplicationsAsync(
                candidateId, It.IsAny<string?>(), It.IsAny<Guid?>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(([], 0));

        var query = new GetCandidateApplicationsQuery(userId);

        // Act
        await _handler.Handle(query, CancellationToken.None);

        // Assert - ensures it queries strictly with the resolved CandidateId
        _applicationRepositoryMock.Verify(r => r.GetCandidateApplicationsAsync(
            candidateId, null, null, null, null, 1, 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldPassFiltersAndClampPagination()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var candidate = new Candidate { CandidateId = candidateId, UserId = userId };

        _candidateRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(candidate);

        _applicationRepositoryMock
            .Setup(r => r.GetCandidateApplicationsAsync(
                candidateId, "SUBMITTED", It.IsAny<Guid?>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), 1, 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([], 0));

        // query with page < 1 (0) and pageSize > 100 (500)
        var filterJobId = Guid.NewGuid();
        var fromDate = DateTime.UtcNow.AddDays(-10);
        var toDate = DateTime.UtcNow;

        _applicationRepositoryMock
            .Setup(r => r.GetCandidateApplicationsAsync(
                candidateId, "SUBMITTED", filterJobId, fromDate, toDate, 1, 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([], 0));

        var query = new GetCandidateApplicationsQuery(
            UserId: userId,
            Status: "SUBMITTED",
            JobId: filterJobId,
            FromDate: fromDate,
            ToDate: toDate,
            Page: 0,
            PageSize: 500);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Data.Page.Should().Be(1);
        result.Data.PageSize.Should().Be(100);

        _applicationRepositoryMock.Verify(r => r.GetCandidateApplicationsAsync(
            candidateId, "SUBMITTED", filterJobId, fromDate, toDate, 1, 100, It.IsAny<CancellationToken>()), Times.Once);
    }
}
