using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateAttributions;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliateAttributionsQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepoMock;
    private readonly Mock<IAttributionRepository> _attributionRepoMock;
    private readonly GetAffiliateAttributionsQueryHandler _handler;

    public GetAffiliateAttributionsQueryHandlerTests()
    {
        _affiliateProfileRepoMock = new Mock<IAffiliateProfileRepository>();
        _attributionRepoMock = new Mock<IAttributionRepository>();
        _handler = new GetAffiliateAttributionsQueryHandler(
            _affiliateProfileRepoMock.Object,
            _attributionRepoMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateProfileDoesNotExist_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var query = new GetAffiliateAttributionsQuery(userId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*hồ sơ Affiliate Recruiter*");
    }

    [Fact]
    public async Task Handle_WhenAffiliateHasAttributions_ShouldReturnCorrectlyProjectedItems()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var affiliateProfile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            AffiliateType = "INDIVIDUAL",
            DisplayName = "Affiliate Recruiter A"
        };

        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var attributionId = Guid.NewGuid();
        var submissionId = Guid.NewGuid();
        var establishedAt = DateTime.UtcNow.AddDays(-3);

        var attribution = new Attribution
        {
            AttributionId = attributionId,
            AffiliateId = affiliateId,
            ApplicationId = applicationId,
            WinningSubmissionId = submissionId,
            AttributionRule = "FIRST_ACCEPTED_SUBMISSION",
            Status = "ACTIVE",
            EstablishedAt = establishedAt,
            UpdatedAt = establishedAt,
            Application = new JobApplication
            {
                ApplicationId = applicationId,
                CandidateId = candidateId,
                JobId = jobId,
                Candidate = new Candidate { FullName = "Le Thi B" },
                Job = new Job { Title = "Senior Frontend Engineer" }
            },
            WinningSubmission = new Submission
            {
                SubmissionId = submissionId,
                CvId = cvId
            }
        };

        var items = new List<Attribution> { attribution };

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateProfile);

        _attributionRepoMock.Setup(r => r.GetAffiliateAttributionsAsync(
                affiliateId, null, null, null, null, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((items, 1));

        var query = new GetAffiliateAttributionsQuery(userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.TotalCount.Should().Be(1);
        result.Items.Should().HaveCount(1);

        var item = result.Items[0];
        item.AttributionId.Should().Be(attributionId);
        item.ApplicationId.Should().Be(applicationId);
        item.CandidateId.Should().Be(candidateId);
        item.CandidateName.Should().Be("Le Thi B");
        item.JobId.Should().Be(jobId);
        item.JobTitle.Should().Be("Senior Frontend Engineer");
        item.CvId.Should().Be(cvId);
        item.AttributionRule.Should().Be("FIRST_ACCEPTED_SUBMISSION");
        item.Status.Should().Be("ACTIVE");
        item.EstablishedAt.Should().Be(establishedAt);
    }

    [Fact]
    public async Task Handle_WithFiltersAndPagination_ShouldClampPaginationAndPassFilters()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        var affiliateProfile = new AffiliateProfile
        {
            AffiliateId = affiliateId,
            UserId = userId,
            AffiliateType = "INDIVIDUAL"
        };

        var jobId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var fromDate = DateTime.UtcNow.AddDays(-14);
        var toDate = DateTime.UtcNow;

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateProfile);

        _attributionRepoMock.Setup(r => r.GetAffiliateAttributionsAsync(
                affiliateId, jobId, candidateId, fromDate, toDate, 1, 50, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Attribution>(), 0));

        var query = new GetAffiliateAttributionsQuery(
            UserId: userId,
            JobId: jobId,
            CandidateId: candidateId,
            FromDate: fromDate,
            ToDate: toDate,
            Page: 1,
            PageSize: 50);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(50);
        _attributionRepoMock.Verify(r => r.GetAffiliateAttributionsAsync(
            affiliateId, jobId, candidateId, fromDate, toDate, 1, 50, It.IsAny<CancellationToken>()), Times.Once);
    }
}
