using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Queries.GetInterviewDetail;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Interviews;

public class GetInterviewDetailQueryHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetInterviewDetailQueryHandler>> _loggerMock = new();

    private GetInterviewDetailQueryHandler CreateHandler() =>
        new(_interviewRepositoryMock.Object, _companyUserRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenInterviewNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Interview?)null);

        var query = new GetInterviewDetailQuery(
            InterviewId: interviewId,
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Không tìm thấy thông tin lịch phỏng vấn.");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserFromDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var companyB = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var interview = CreateSampleInterview(interviewId, companyA, Guid.NewGuid());
        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyB });

        var query = new GetInterviewDetailQuery(
            InterviewId: interviewId,
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền xem thông tin lịch phỏng vấn của công ty khác.");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserFromSameCompany_ShouldReturnDetailSuccessfully()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var interview = CreateSampleInterview(interviewId, companyA, Guid.NewGuid());
        var interviewerUser = new AppUser { UserId = Guid.NewGuid(), DisplayName = "Interviewer Bob", Email = "bob@example.com" };
        interview.InterviewParticipants.Add(new InterviewParticipant
        {
            InterviewId = interviewId,
            UserId = interviewerUser.UserId,
            User = interviewerUser,
            Role = "INTERVIEWER"
        });

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interviewId,
            OldStatus = "SCHEDULED",
            NewStatus = "RESCHEDULED",
            Reason = "Ứng viên bận việc đột xuất",
            ChangedAt = DateTime.UtcNow.AddDays(-1)
        });

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyA });

        var query = new GetInterviewDetailQuery(
            InterviewId: interviewId,
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.InterviewId.Should().Be(interviewId);
        result.Data.CompanyId.Should().Be(companyA);
        result.Data.Participants.Should().HaveCount(1);
        result.Data.Participants[0].Name.Should().Be("Interviewer Bob");
        result.Data.StatusHistories.Should().HaveCount(1);
        result.Data.StatusHistories[0].Reason.Should().Be("Ứng viên bận việc đột xuất");
    }

    [Fact]
    public async Task Handle_WhenCandidateAccessesOwnInterview_ShouldReturnDetailSuccessfully()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var interview = CreateSampleInterview(interviewId, Guid.NewGuid(), candidateUserId);

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var query = new GetInterviewDetailQuery(
            InterviewId: interviewId,
            UserId: candidateUserId,
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false,
            IsCandidate: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.InterviewId.Should().Be(interviewId);
        result.Data.CandidateFullName.Should().Be("Hoang Van E");
    }

    [Fact]
    public async Task Handle_WhenCandidateAccessesAnotherInterview_ShouldThrowForbiddenException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var actualCandidateUserId = Guid.NewGuid();
        var differentCandidateUserId = Guid.NewGuid();
        var interview = CreateSampleInterview(interviewId, Guid.NewGuid(), actualCandidateUserId);

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var query = new GetInterviewDetailQuery(
            InterviewId: interviewId,
            UserId: differentCandidateUserId,
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false,
            IsCandidate: true
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền xem thông tin lịch phỏng vấn này.");
    }

    [Fact]
    public async Task Handle_WhenInternalHrOrAdmin_ShouldReturnDetailForAnyCompany()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var interview = CreateSampleInterview(interviewId, Guid.NewGuid(), Guid.NewGuid());

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var query = new GetInterviewDetailQuery(
            InterviewId: interviewId,
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.InterviewId.Should().Be(interviewId);
        _companyUserRepositoryMock.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WhenUserHasNeitherRole_ShouldThrowForbiddenException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var interview = CreateSampleInterview(interviewId, Guid.NewGuid(), Guid.NewGuid());

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var query = new GetInterviewDetailQuery(
            InterviewId: interviewId,
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền xem chi tiết lịch phỏng vấn.");
    }

    private static Interview CreateSampleInterview(Guid interviewId, Guid companyId, Guid candidateUserId)
    {
        var company = new Company { CompanyId = companyId, CompanyName = "Enterprise Global" };
        var job = new Job { JobId = Guid.NewGuid(), Title = "Frontend Engineer", CompanyId = companyId, Company = company };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            UserId = candidateUserId,
            FullName = "Hoang Van E",
            Email = "vane@example.com",
            Phone = "0945678901"
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
            InterviewId = interviewId,
            ApplicationId = application.ApplicationId,
            Application = application,
            InterviewRound = 1,
            InterviewType = "ONLINE",
            ScheduledAt = DateTime.UtcNow.AddDays(2),
            DurationMinutes = 45,
            Location = "Microsoft Teams",
            MeetingLink = "https://teams.microsoft.com/l/meetup-join/12345",
            Status = "SCHEDULED",
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            ConcurrencyToken = Guid.NewGuid()
        };
    }
}
