using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissions;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliateSubmissionsQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepoMock;
    private readonly Mock<ISubmissionRepository> _submissionRepoMock;
    private readonly GetAffiliateSubmissionsQueryHandler _handler;

    public GetAffiliateSubmissionsQueryHandlerTests()
    {
        _affiliateProfileRepoMock = new Mock<IAffiliateProfileRepository>();
        _submissionRepoMock = new Mock<ISubmissionRepository>();
        _handler = new GetAffiliateSubmissionsQueryHandler(
            _affiliateProfileRepoMock.Object,
            _submissionRepoMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateProfileDoesNotExist_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var query = new GetAffiliateSubmissionsQuery(userId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*hồ sơ Affiliate Recruiter*");
    }

    [Fact]
    public async Task Handle_WhenAffiliateHasSubmissions_ShouldReturnAcceptedAndBlockedDuplicateSubmissions()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var affiliateProfile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            AffiliateType = "INDIVIDUAL",
            DisplayName = "Affiliate One"
        };

        var candidateId1 = Guid.NewGuid();
        var candidateId2 = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var winningSubmissionId = Guid.NewGuid();
        var duplicateSubmissionId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var attributionId = Guid.NewGuid();

        var acceptedSubmission = new Submission
        {
            SubmissionId = winningSubmissionId,
            CandidateId = candidateId1,
            CvId = Guid.NewGuid(),
            JobId = jobId,
            SubmittedBy = userId,
            Source = "AFFILIATE",
            Status = "ACCEPTED",
            SubmittedAt = DateTime.UtcNow.AddDays(-2),
            Candidate = new Candidate { FullName = "Candidate One" },
            Job = new Job { Title = "Backend Developer" },
            Applications = new List<JobApplication>
            {
                new() { ApplicationId = applicationId, AcceptedSubmissionId = winningSubmissionId }
            },
            Attribution = new Attribution
            {
                AttributionId = attributionId,
                AffiliateId = affiliateId,
                WinningSubmissionId = winningSubmissionId
            }
        };

        var blockedSubmission = new Submission
        {
            SubmissionId = duplicateSubmissionId,
            CandidateId = candidateId2,
            CvId = Guid.NewGuid(),
            JobId = jobId,
            SubmittedBy = userId,
            Source = "AFFILIATE",
            Status = "BLOCKED_DUPLICATE",
            DuplicateOfSubmissionId = winningSubmissionId,
            Note = "Ứng viên đã được nộp vào công việc này trước đó.",
            SubmittedAt = DateTime.UtcNow.AddDays(-1),
            Candidate = new Candidate { FullName = "Candidate Two" },
            Job = new Job { Title = "Backend Developer" },
            Applications = new List<JobApplication>(),
            Attribution = null
        };

        var items = new List<Submission> { blockedSubmission, acceptedSubmission };

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateProfile);

        _submissionRepoMock.Setup(r => r.GetAffiliateSubmissionsAsync(
                userId, null, null, null, null, null, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((items, 2));

        var query = new GetAffiliateSubmissionsQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.TotalCount.Should().Be(2);
        result.Items.Should().HaveCount(2);

        // Item 1: BLOCKED_DUPLICATE
        var item1 = result.Items[0];
        item1.SubmissionId.Should().Be(duplicateSubmissionId);
        item1.Status.Should().Be("BLOCKED_DUPLICATE");
        item1.CandidateName.Should().Be("Candidate Two");
        item1.JobTitle.Should().Be("Backend Developer");
        item1.ApplicationId.Should().BeNull();
        item1.AttributionId.Should().BeNull();
        item1.DuplicateOfSubmissionId.Should().Be(winningSubmissionId);
        item1.Reason.Should().Be("Ứng viên đã được nộp vào công việc này trước đó.");

        // Item 2: ACCEPTED
        var item2 = result.Items[1];
        item2.SubmissionId.Should().Be(winningSubmissionId);
        item2.Status.Should().Be("ACCEPTED");
        item2.CandidateName.Should().Be("Candidate One");
        item2.JobTitle.Should().Be("Backend Developer");
        item2.ApplicationId.Should().Be(applicationId);
        item2.AttributionId.Should().Be(attributionId);
        item2.DuplicateOfSubmissionId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WithPaginationAndFiltering_ShouldClampPaginationAndPassFilters()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateProfile = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId };
        var jobId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var fromDate = DateTime.UtcNow.AddDays(-10);
        var toDate = DateTime.UtcNow;

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateProfile);

        _submissionRepoMock.Setup(r => r.GetAffiliateSubmissionsAsync(
                userId, "ACCEPTED", jobId, candidateId, fromDate, toDate, 1, 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Submission>(), 0));

        var query = new GetAffiliateSubmissionsQuery(
            UserId: userId,
            Status: "ACCEPTED",
            JobId: jobId,
            CandidateId: candidateId,
            FromDate: fromDate,
            ToDate: toDate,
            Page: -5,
            PageSize: 999);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(100);
        _submissionRepoMock.Verify(r => r.GetAffiliateSubmissionsAsync(
            userId, "ACCEPTED", jobId, candidateId, fromDate, toDate, 1, 100, It.IsAny<CancellationToken>()), Times.Once);
    }
}
