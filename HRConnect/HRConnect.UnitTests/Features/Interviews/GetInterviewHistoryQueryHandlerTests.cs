using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Interviews.Queries.GetInterviewHistory;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Interviews;

public class GetInterviewHistoryQueryHandlerTests
{
    private readonly Mock<IInterviewRepository> _interviewRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetInterviewHistoryQueryHandler>> _loggerMock = new();

    private GetInterviewHistoryQueryHandler CreateHandler() =>
        new(
            _interviewRepositoryMock.Object,
            _companyUserRepositoryMock.Object,
            _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenInterviewNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Interview?)null);

        var query = new GetInterviewHistoryQuery(interviewId, Guid.NewGuid(), IsInternalHrOrAdmin: true);

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Không tìm thấy lịch phỏng vấn*");
    }

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_AndDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var userCompanyId = Guid.NewGuid();
        var jobCompanyId = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            Application = new HRConnect.Domain.Entities.Application
            {
                Job = new Job { CompanyId = jobCompanyId }
            }
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = userCompanyId });

        var query = new GetInterviewHistoryQuery(interviewId, userId, IsClientCompanyUser: true);

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*doanh nghiệp khác*");
    }

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_AndSameCompany_ShouldReturnHistoriesOrdered()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();

        var t1 = DateTime.UtcNow.AddDays(-2);
        var t2 = DateTime.UtcNow.AddDays(-1);

        var interview = new Interview
        {
            InterviewId = interviewId,
            Application = new HRConnect.Domain.Entities.Application
            {
                Job = new Job { CompanyId = companyId }
            },
            InterviewStatusHistories = new List<InterviewStatusHistory>
            {
                new()
                {
                    InterviewStatusHistoryId = Guid.NewGuid(),
                    InterviewId = interviewId,
                    OldStatus = "SCHEDULED",
                    NewStatus = "RESCHEDULED",
                    Reason = "Dời lịch lần 1",
                    ChangedAt = t2
                },
                new()
                {
                    InterviewStatusHistoryId = Guid.NewGuid(),
                    InterviewId = interviewId,
                    OldStatus = null,
                    NewStatus = "SCHEDULED",
                    Reason = "Lập lịch mới",
                    ChangedAt = t1
                }
            }
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        var query = new GetInterviewHistoryQuery(interviewId, userId, IsClientCompanyUser: true);

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().HaveCount(2);
        result.Data[0].NewStatus.Should().Be("SCHEDULED"); // Ordered by ChangedAt ASC
        result.Data[1].NewStatus.Should().Be("RESCHEDULED");
    }

    [Fact]
    public async Task Handle_WhenUserIsCandidate_AndOwnInterview_ShouldReturnHistories()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            Application = new HRConnect.Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = candidateUserId }
            },
            InterviewStatusHistories = new List<InterviewStatusHistory>
            {
                new()
                {
                    InterviewStatusHistoryId = Guid.NewGuid(),
                    InterviewId = interviewId,
                    OldStatus = null,
                    NewStatus = "SCHEDULED",
                    Reason = "Lập lịch",
                    ChangedAt = DateTime.UtcNow
                }
            }
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var query = new GetInterviewHistoryQuery(interviewId, candidateUserId, IsCandidate: true);

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Success.Should().BeTrue();
        result.Data.Should().HaveCount(1);
    }

    [Fact]
    public async Task Handle_WhenUserIsCandidate_AndDifferentCandidate_ShouldThrowForbiddenException()
    {
        // Arrange
        var interviewId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            Application = new HRConnect.Domain.Entities.Application
            {
                Candidate = new Candidate { UserId = otherUserId }
            }
        };

        _interviewRepositoryMock
            .Setup(r => r.GetByIdWithDetailsAsync(interviewId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(interview);

        var query = new GetInterviewHistoryQuery(interviewId, candidateUserId, IsCandidate: true);

        // Act
        Func<Task> act = async () => await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*ứng viên khác*");
    }
}
