using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetCandidateRecruitmentApplicationDetailQueryHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ILogger<GetCandidateRecruitmentApplicationDetailQueryHandler>> _loggerMock = new();

    private GetCandidateRecruitmentApplicationDetailQueryHandler CreateHandler() =>
        new(_applicationRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.Application?)null);

        var query = new GetCandidateRecruitmentApplicationDetailQuery(appId, Guid.NewGuid());

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Không tìm thấy thông tin hồ sơ ứng tuyển.");
    }

    [Fact]
    public async Task Handle_WhenUserIsNotOwnerCandidate_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var callerUserId = Guid.NewGuid();

        var app = new Domain.Entities.Application
        {
            ApplicationId = appId,
            Candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = candidateUserId }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetCandidateRecruitmentApplicationDetailQuery(appId, callerUserId);

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền xem chi tiết hồ sơ tuyển dụng này.");
    }

    [Fact]
    public async Task Handle_WhenValidCandidateOwner_ShouldReturnSanitizedProjectionAndComputeAllowedActions()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var candidateId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var jobId = Guid.NewGuid();

        var app = new Domain.Entities.Application
        {
            ApplicationId = appId,
            JobId = jobId,
            Job = new Job
            {
                JobId = jobId,
                Title = "Backend Engineer",
                CompanyId = companyId,
                Company = new Company { CompanyId = companyId, CompanyName = "Tech Corp" }
            },
            CandidateId = candidateId,
            Candidate = new Candidate
            {
                CandidateId = candidateId,
                UserId = candidateUserId,
                FullName = "Nguyen Van A"
            },
            Status = ApplicationStates.Shortlisted,
            AppliedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid(),
            Interviews = new List<Interview>
            {
                new Interview
                {
                    InterviewId = Guid.NewGuid(),
                    InterviewRound = 1,
                    InterviewType = "ONLINE",
                    ScheduledAt = DateTime.UtcNow.AddDays(2),
                    DurationMinutes = 45,
                    MeetingLink = "https://meet.google.com/xyz",
                    Status = InterviewStates.Scheduled,
                    Feedback = "Internal HR note: very strong candidate", // Internal feedback - should be sanitized
                    Result = InterviewResults.Pass
                }
            },
            Offers = new List<Offer>
            {
                new Offer
                {
                    OfferId = Guid.NewGuid(),
                    OfferVersion = 1,
                    Status = OfferStates.Draft, // DRAFT offer - should be excluded
                    Salary = 20000000,
                    ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3))
                },
                new Offer
                {
                    OfferId = Guid.NewGuid(),
                    OfferVersion = 2,
                    Status = OfferStates.Sent, // SENT offer - should be included
                    Salary = 25000000,
                    CurrencyCode = "VND",
                    StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14)),
                    ExpiryDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
                    ConcurrencyToken = Guid.NewGuid()
                }
            }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId);

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();
        var data = result.Data!;

        data.ApplicationId.Should().Be(appId);
        data.JobTitle.Should().Be("Backend Engineer");
        data.CompanyName.Should().Be("Tech Corp");
        data.Status.Should().Be(ApplicationStates.Shortlisted);
        data.ConcurrencyToken.Should().NotBeEmpty();

        // Check Interview sanitization: no internal feedback/result exposed
        data.Interviews.Should().HaveCount(1);
        data.Interviews[0].MeetingLink.Should().Be("https://meet.google.com/xyz");
        data.Interviews[0].Status.Should().Be(InterviewStates.Scheduled);

        // Check Offer filtering: Draft must NOT be included, Sent must be included
        data.Offers.Should().HaveCount(1);
        data.Offers[0].Status.Should().Be(OfferStates.Sent);
        data.Offers[0].Salary.Should().Be(25000000);
        data.Offers[0].CanRespond.Should().BeTrue();

        // Check Allowed Actions
        data.AllowedActions.Should().Contain("WITHDRAW_APPLICATION");
        data.AllowedActions.Should().Contain("VIEW_INTERVIEW");
        data.AllowedActions.Should().Contain("RESPOND_OFFER");
    }
}
