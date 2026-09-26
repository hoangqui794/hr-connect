using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationTimeline;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetRecruitmentApplicationTimelineQueryHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetRecruitmentApplicationTimelineQueryHandler>> _loggerMock = new();

    private GetRecruitmentApplicationTimelineQueryHandler CreateHandler() =>
        new(_applicationRepositoryMock.Object, _companyUserRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        _applicationRepositoryMock
            .Setup(r => r.GetApplicationTimelineDataAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.Application?)null);

        var query = new GetRecruitmentApplicationTimelineQuery(
            ApplicationId: appId,
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("Không tìm thấy thông tin hồ sơ ứng tuyển.");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserFromDifferentCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var companyB = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var app = CreateSampleApplication(appId, companyA, "APPLIED");
        _applicationRepositoryMock
            .Setup(r => r.GetApplicationTimelineDataAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyB });

        var query = new GetRecruitmentApplicationTimelineQuery(
            ApplicationId: appId,
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền truy cập hồ sơ ứng tuyển của công ty khác.");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserFromSameCompany_ShouldReturnTimelineInAscendingOrder()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var app = CreateSampleApplication(appId, companyA, "INTERVIEWING");
        var baseTime = DateTime.UtcNow.AddDays(-10);
        app.AppliedAt = baseTime;

        // 1. Status history
        app.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            OldStatus = "APPLIED",
            NewStatus = "SCREENING_PASSED",
            ChangedAt = baseTime.AddDays(1),
            Reason = "CV phù hợp yêu cầu"
        });

        // 2. Interview scheduled & result
        app.Interviews.Add(new Interview
        {
            InterviewId = Guid.NewGuid(),
            InterviewRound = 1,
            InterviewType = "ONLINE",
            ScheduledAt = baseTime.AddDays(3),
            Status = "COMPLETED",
            Result = "PASS",
            Feedback = "Ứng viên trả lời rất tốt",
            CreatedAt = baseTime.AddDays(2),
            RecordedAt = baseTime.AddDays(3).AddHours(1)
        });

        // 3. Offer created and sent
        app.Offers.Add(new Offer
        {
            OfferId = Guid.NewGuid(),
            OfferVersion = 1,
            Salary = 35000000m,
            CurrencyCode = "VND",
            Status = "SENT",
            CreatedAt = baseTime.AddDays(4),
            SentAt = baseTime.AddDays(4).AddHours(2)
        });

        _applicationRepositoryMock
            .Setup(r => r.GetApplicationTimelineDataAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyA });

        var query = new GetRecruitmentApplicationTimelineQuery(
            ApplicationId: appId,
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false,
            Ascending: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.ApplicationId.Should().Be(appId);
        result.Data.Events.Should().HaveCount(6); // Applied + StatusChanged + InterviewScheduled + InterviewResult + OfferCreated + OfferSent

        // Check ascending order
        for (int i = 0; i < result.Data.Events.Count - 1; i++)
        {
            result.Data.Events[i].Timestamp.Should().BeOnOrBefore(result.Data.Events[i + 1].Timestamp);
        }

        result.Data.Events.First().EventType.Should().Be("APPLICATION_APPLIED");
        result.Data.Events.Last().EventType.Should().Be("OFFER_SENT");
    }

    [Fact]
    public async Task Handle_WhenDescending_ShouldOrderEventsDescending()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var app = CreateSampleApplication(appId, companyA, "APPLIED");
        app.AppliedAt = DateTime.UtcNow.AddDays(-5);
        app.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            OldStatus = "APPLIED",
            NewStatus = "SCREENING_PASSED",
            ChangedAt = DateTime.UtcNow.AddDays(-2)
        });

        _applicationRepositoryMock
            .Setup(r => r.GetApplicationTimelineDataAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetRecruitmentApplicationTimelineQuery(
            ApplicationId: appId,
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true,
            Ascending: false
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Events.First().EventType.Should().Be("APPLICATION_STATUS_CHANGED");
        result.Data.Events.Last().EventType.Should().Be("APPLICATION_APPLIED");
    }

    [Fact]
    public async Task Handle_WhenUserHasNeitherRole_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var app = CreateSampleApplication(appId, Guid.NewGuid(), "APPLIED");

        _applicationRepositoryMock
            .Setup(r => r.GetApplicationTimelineDataAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetRecruitmentApplicationTimelineQuery(
            ApplicationId: appId,
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền xem dòng thời gian hồ sơ tuyển dụng.");
    }

    private static Domain.Entities.Application CreateSampleApplication(Guid applicationId, Guid companyId, string status)
    {
        var company = new Company { CompanyId = companyId, CompanyName = "Tech Corp" };
        var job = new Job { JobId = Guid.NewGuid(), Title = "Solution Architect", CompanyId = companyId, Company = company };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Le Van C",
            Email = "vanc@example.com"
        };

        return new Domain.Entities.Application
        {
            ApplicationId = applicationId,
            JobId = job.JobId,
            Job = job,
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            Status = status,
            AppliedAt = DateTime.UtcNow.AddDays(-10),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
            ConcurrencyToken = Guid.NewGuid()
        };
    }
}
