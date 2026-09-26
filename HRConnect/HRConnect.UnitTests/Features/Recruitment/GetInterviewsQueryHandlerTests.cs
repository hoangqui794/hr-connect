using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Queries.GetInterviews;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetInterviewsQueryHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetInterviewsQueryHandler>> _loggerMock = new();

    private GetInterviewsQueryHandler CreateHandler() =>
        new(_interviewRepositoryMock.Object, _companyUserRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_ShouldFilterByCompanyId()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var interview = CreateSampleInterview(companyId, "SCHEDULED");

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        _interviewRepositoryMock
            .Setup(r => r.GetInterviewsAsync(
                companyId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([interview], 1));

        var query = new GetInterviewsQuery(
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Total.Should().Be(1);
        result.Data.Items.Should().HaveCount(1);
        result.Data.Items[0].CompanyId.Should().Be(companyId);
        result.Data.Items[0].InterviewRound.Should().Be(1);
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserHasNoCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var query = new GetInterviewsQuery(
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Tài khoản không thuộc doanh nghiệp nào.");
    }

    [Fact]
    public async Task Handle_WhenUserIsInternalHrOrAdmin_ShouldQueryWithoutCompanyScope()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var interview = CreateSampleInterview(companyId, "COMPLETED");

        _interviewRepositoryMock
            .Setup(r => r.GetInterviewsAsync(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([interview], 1));

        var query = new GetInterviewsQuery(
            UserId: userId,
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Total.Should().Be(1);
        _companyUserRepositoryMock.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _interviewRepositoryMock.Verify(r => r.GetInterviewsAsync(
            null, null, null, null, null, null, null, null, null, 1, 10, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenUserIsCandidate_ShouldFilterByCandidateUserId()
    {
        // Arrange
        var candidateUserId = Guid.NewGuid();
        var interview = CreateSampleInterview(Guid.NewGuid(), "SCHEDULED");

        _interviewRepositoryMock
            .Setup(r => r.GetInterviewsAsync(
                null,
                candidateUserId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([interview], 1));

        var query = new GetInterviewsQuery(
            UserId: candidateUserId,
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false,
            IsCandidate: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        _interviewRepositoryMock.Verify(r => r.GetInterviewsAsync(
            null, candidateUserId, null, null, null, null, null, null, null, 1, 10, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenUserHasNoValidRole_ShouldThrowForbiddenException()
    {
        // Arrange
        var query = new GetInterviewsQuery(
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false,
            IsCandidate: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền xem danh sách lịch phỏng vấn.");
    }

    [Fact]
    public async Task Handle_ShouldMapInterviewParticipantsAndJobDetailsCorrectly()
    {
        // Arrange
        var companyId = Guid.NewGuid();
        var interview = CreateSampleInterview(companyId, "COMPLETED");
        interview.Result = "PASS";
        interview.Feedback = "Rất ấn tượng với kiến thức kiến trúc hệ thống";
        interview.ScheduledAt = DateTime.UtcNow.AddDays(-2);

        var participantUser = new AppUser
        {
            UserId = Guid.NewGuid(),
            DisplayName = "Interviewer One",
            Email = "interviewer@example.com"
        };
        interview.InterviewParticipants.Add(new InterviewParticipant
        {
            InterviewId = interview.InterviewId,
            UserId = participantUser.UserId,
            User = participantUser,
            Role = "LEAD_INTERVIEWER"
        });

        _interviewRepositoryMock
            .Setup(r => r.GetInterviewsAsync(
                null, null, null, null, null, null, null, null, null, 1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([interview], 1));

        var query = new GetInterviewsQuery(
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        var item = result.Data.Items.Single();
        item.JobTitle.Should().Be("DevOps Lead");
        item.CandidateName.Should().Be("Pham Thi D");
        item.Result.Should().Be("PASS");
        item.Feedback.Should().Be("Rất ấn tượng với kiến thức kiến trúc hệ thống");
        item.Participants.Should().HaveCount(1);
        item.Participants[0].Name.Should().Be("Interviewer One");
        item.Participants[0].Role.Should().Be("LEAD_INTERVIEWER");
    }

    private static Interview CreateSampleInterview(Guid companyId, string status)
    {
        var company = new Company { CompanyId = companyId, CompanyName = "Fintech Group" };
        var job = new Job { JobId = Guid.NewGuid(), Title = "DevOps Lead", CompanyId = companyId, Company = company };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Pham Thi D",
            Email = "thid@example.com",
            Phone = "0934567890"
        };

        var application = new Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = job.JobId,
            Job = job,
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            Status = "INTERVIEWING"
        };

        return new Interview
        {
            InterviewId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            Application = application,
            InterviewRound = 1,
            InterviewType = "ONLINE",
            ScheduledAt = DateTime.UtcNow.AddDays(1),
            DurationMinutes = 60,
            Location = "Google Meet",
            MeetingLink = "https://meet.google.com/xyz-abc-def",
            Status = status,
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            ConcurrencyToken = Guid.NewGuid()
        };
    }
}
