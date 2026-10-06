using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissionDetail;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Affiliates;

public class GetAffiliateSubmissionDetailQueryHandlerTests
{
    private readonly Mock<IAffiliateProfileRepository> _affiliateProfileRepoMock;
    private readonly Mock<ISubmissionRepository> _submissionRepoMock;
    private readonly GetAffiliateSubmissionDetailQueryHandler _handler;

    public GetAffiliateSubmissionDetailQueryHandlerTests()
    {
        _affiliateProfileRepoMock = new Mock<IAffiliateProfileRepository>();
        _submissionRepoMock = new Mock<ISubmissionRepository>();
        _handler = new GetAffiliateSubmissionDetailQueryHandler(
            _affiliateProfileRepoMock.Object,
            _submissionRepoMock.Object);
    }

    [Fact]
    public async Task Handle_WhenAffiliateProfileDoesNotExist_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var submissionId = Guid.NewGuid();

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((AffiliateProfile?)null);

        var query = new GetAffiliateSubmissionDetailQuery(submissionId, userId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*hồ sơ Affiliate Recruiter*");
    }

    [Fact]
    public async Task Handle_WhenSubmissionDoesNotExist_ShouldThrowNotFoundException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var submissionId = Guid.NewGuid();

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { UserId = userId });

        _submissionRepoMock.Setup(r => r.GetByIdWithDetailsAsync(submissionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Submission?)null);

        var query = new GetAffiliateSubmissionDetailQuery(submissionId, userId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*lượt nộp ứng viên*");
    }

    [Fact]
    public async Task Handle_WhenSubmissionBelongsToAnotherAffiliate_ShouldThrowForbiddenException()
    {
        // Arrange
        var currentUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var submissionId = Guid.NewGuid();

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(currentUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { UserId = currentUserId });

        var submission = new Submission
        {
            SubmissionId = submissionId,
            SubmittedBy = otherUserId // Belongs to someone else
        };

        _submissionRepoMock.Setup(r => r.GetByIdWithDetailsAsync(submissionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(submission);

        var query = new GetAffiliateSubmissionDetailQuery(submissionId, currentUserId);

        // Act & Assert
        var act = () => _handler.Handle(query, CancellationToken.None);
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*không có quyền truy cập*");
    }

    [Fact]
    public async Task Handle_WhenOwnAcceptedSubmission_ShouldReturnFullDetail()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var submissionId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var jobId = Guid.NewGuid();
        var cvId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var attributionId = Guid.NewGuid();
        var submittedAt = DateTime.UtcNow.AddDays(-1);

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { UserId = userId });

        var submission = new Submission
        {
            SubmissionId = submissionId,
            CandidateId = candidateId,
            JobId = jobId,
            CvId = cvId,
            SubmittedBy = userId,
            Source = "AFFILIATE",
            Status = "ACCEPTED",
            SubmittedAt = submittedAt,
            UpdatedAt = submittedAt,
            Candidate = new Candidate
            {
                FullName = "Tran Van C",
                Email = "tranvanc@example.com",
                Phone = "0901234567"
            },
            Job = new Job
            {
                Title = "Fullstack .NET & React",
                Company = new Company { CompanyName = "InnovateX" }
            },
            CandidateCv = new CandidateCv
            {
                Title = "CV Tran Van C",
                FileName = "tranvanc_cv.pdf"
            },
            Applications = new List<JobApplication>
            {
                new() { ApplicationId = applicationId, AcceptedSubmissionId = submissionId }
            },
            Attribution = new Attribution
            {
                AttributionId = attributionId,
                WinningSubmissionId = submissionId
            }
        };

        _submissionRepoMock.Setup(r => r.GetByIdWithDetailsAsync(submissionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(submission);

        var query = new GetAffiliateSubmissionDetailQuery(submissionId, userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.SubmissionId.Should().Be(submissionId);
        result.Status.Should().Be("ACCEPTED");
        result.CandidateId.Should().Be(candidateId);
        result.CandidateName.Should().Be("Tran Van C");
        result.CandidateEmail.Should().Be("tranvanc@example.com");
        result.CandidatePhone.Should().Be("0901234567");
        result.JobTitle.Should().Be("Fullstack .NET & React");
        result.CompanyName.Should().Be("InnovateX");
        result.CvId.Should().Be(cvId);
        result.CvTitle.Should().Be("CV Tran Van C");
        result.CvFileName.Should().Be("tranvanc_cv.pdf");
        result.ApplicationId.Should().Be(applicationId);
        result.AttributionId.Should().Be(attributionId);
        result.DuplicateOfSubmissionId.Should().BeNull();
        result.Reason.Should().BeNull();
        result.SubmittedAt.Should().Be(submittedAt);
    }

    [Fact]
    public async Task Handle_WhenOwnBlockedDuplicateSubmission_ShouldReturnBlockReasonAndDuplicateLink()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var submissionId = Guid.NewGuid();
        var originalSubmissionId = Guid.NewGuid();

        _affiliateProfileRepoMock.Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new AffiliateProfile { UserId = userId });

        var submission = new Submission
        {
            SubmissionId = submissionId,
            SubmittedBy = userId,
            Source = "AFFILIATE",
            Status = "BLOCKED_DUPLICATE",
            DuplicateOfSubmissionId = originalSubmissionId,
            Note = "Ứng viên đã được nộp trước đó.",
            SubmittedAt = DateTime.UtcNow,
            Candidate = new Candidate { FullName = "Candidate Dup" },
            Job = new Job { Title = "Backend Dev" },
            Applications = new List<JobApplication>(),
            Attribution = null
        };

        _submissionRepoMock.Setup(r => r.GetByIdWithDetailsAsync(submissionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(submission);

        var query = new GetAffiliateSubmissionDetailQuery(submissionId, userId);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Status.Should().Be("BLOCKED_DUPLICATE");
        result.DuplicateOfSubmissionId.Should().Be(originalSubmissionId);
        result.Reason.Should().Be("Ứng viên đã được nộp trước đó.");
        result.ApplicationId.Should().BeNull();
        result.AttributionId.Should().BeNull();
    }
}
