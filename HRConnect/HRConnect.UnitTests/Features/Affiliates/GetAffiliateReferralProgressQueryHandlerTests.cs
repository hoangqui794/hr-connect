using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateReferralProgress;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliateReferralProgressQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliates = new();
    private readonly Mock<ISubmissionRepository> _submissions = new();

    [Fact]
    public async Task Handle_RejectsUserWithoutAffiliateProfile()
    {
        var userId = Guid.NewGuid();
        _affiliates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var handler = new GetAffiliateReferralProgressQueryHandler(_affiliates.Object, _submissions.Object);
        var act = () => handler.Handle(new GetAffiliateReferralProgressQuery(userId), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Theory]
    [InlineData("PENDING_CONSENT", null, "WAITING_CONSENT")]
    [InlineData("ACCEPTED", "SCREENING", "CV_REVIEW")]
    [InlineData("ACCEPTED", "INTERVIEW", "INTERVIEW")]
    [InlineData("ACCEPTED", "OFFER_ACCEPTED", "OFFER")]
    [InlineData("ACCEPTED", "PLACED", "PLACED")]
    [InlineData("ACCEPTED", "INTERVIEW_FAILED", "CLOSED")]
    public async Task Handle_MapsOnlySafeHighLevelProgress(string submissionStatus, string? applicationStatus, string expectedProgress)
    {
        var userId = Guid.NewGuid();
        var application = applicationStatus == null ? null : new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            Status = applicationStatus,
            UpdatedAt = DateTime.UtcNow
        };
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(),
            Status = submissionStatus,
            SubmittedBy = userId,
            UpdatedAt = DateTime.UtcNow.AddMinutes(-1),
            Candidate = new Candidate { FullName = "Candidate One" },
            Job = new Job { Title = "Backend Developer", Company = new Company { CompanyName = "Company One" } },
            Applications = application == null ? new List<JobApplication>() : new List<JobApplication> { application }
        };

        _affiliates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        _submissions.Setup(repository => repository.GetAffiliateSubmissionsAsync(
                userId, null, null, null, null, null, 1, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Submission> { submission }, 1));

        var handler = new GetAffiliateReferralProgressQueryHandler(_affiliates.Object, _submissions.Object);
        var result = await handler.Handle(new GetAffiliateReferralProgressQuery(userId), CancellationToken.None);

        var item = result.Items.Should().ContainSingle().Subject;
        item.ProgressStatus.Should().Be(expectedProgress);
        item.CandidateName.Should().Be("Candidate One");
        item.JobTitle.Should().Be("Backend Developer");
        item.CompanyName.Should().Be("Company One");
        item.GetType().GetProperties().Select(property => property.Name)
            .Should().NotContain(new[] { "InterviewTime", "MeetingLink", "Feedback", "Salary", "OfferDocumentUrl", "StatusReason" });
    }

    [Fact]
    public async Task Handle_ClampsPaginationAndScopesRepositoryToCurrentAffiliateUser()
    {
        var userId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        _affiliates.Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = userId });
        _submissions.Setup(repository => repository.GetAffiliateSubmissionsAsync(
                userId, null, jobId, null, null, null, 1, 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Submission>(), 0));

        var handler = new GetAffiliateReferralProgressQueryHandler(_affiliates.Object, _submissions.Object);
        var result = await handler.Handle(new GetAffiliateReferralProgressQuery(userId, jobId, -1, 1000), CancellationToken.None);

        result.Page.Should().Be(1);
        result.PageSize.Should().Be(100);
        _submissions.Verify(repository => repository.GetAffiliateSubmissionsAsync(
            userId, null, jobId, null, null, null, 1, 100, It.IsAny<CancellationToken>()), Times.Once);
    }
}
