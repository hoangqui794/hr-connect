using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplications;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetRecruitmentApplicationsQueryHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetRecruitmentApplicationsQueryHandler>> _loggerMock = new();

    private GetRecruitmentApplicationsQueryHandler CreateHandler() =>
        new(_applicationRepositoryMock.Object, _companyUserRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenUserIsClientCompanyUser_ShouldFilterByUsersCompanyId()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var member = new CompanyUser { UserId = userId, CompanyId = companyId };

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(member);

        var app = CreateSampleApplication(companyId, "APPLIED");
        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationsAsync(
                companyId,
                null,
                null,
                null,
                null,
                null,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([app], 1));

        var query = new GetRecruitmentApplicationsQuery(
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
        result.Data.Items[0].CandidateName.Should().Be("Nguyen Van A");
    }

    [Fact]
    public async Task Handle_WhenClientCompanyUserHasNoCompany_ShouldThrowForbiddenException()
    {
        // Arrange
        var userId = Guid.NewGuid();
        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var query = new GetRecruitmentApplicationsQuery(
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
        var app = CreateSampleApplication(companyId, "SCREENING_PASSED");

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationsAsync(
                null,
                null,
                null,
                null,
                null,
                null,
                1,
                10,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(([app], 1));

        var query = new GetRecruitmentApplicationsQuery(
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
        _applicationRepositoryMock.Verify(r => r.GetRecruitmentApplicationsAsync(
            null, null, null, null, null, null, 1, 10, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WhenUserHasNeitherRole_ShouldThrowForbiddenException()
    {
        // Arrange
        var query = new GetRecruitmentApplicationsQuery(
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền truy cập danh sách tuyển dụng.");
    }

    [Fact]
    public async Task Handle_ShouldMapAiScoreInterviewAndOfferDetailsCorrectly()
    {
        // Arrange
        var companyId = Guid.NewGuid();
        var app = CreateSampleApplication(companyId, "INTERVIEWING");

        // Add 2 interviews
        app.Interviews.Add(new Interview
        {
            InterviewId = Guid.NewGuid(),
            InterviewRound = 1,
            Status = "COMPLETED",
            Result = "PASS",
            ScheduledAt = DateTime.UtcNow.AddDays(-5),
            CreatedAt = DateTime.UtcNow.AddDays(-6)
        });
        app.Interviews.Add(new Interview
        {
            InterviewId = Guid.NewGuid(),
            InterviewRound = 2,
            Status = "SCHEDULED",
            Result = null,
            ScheduledAt = DateTime.UtcNow.AddDays(2),
            CreatedAt = DateTime.UtcNow.AddDays(-1)
        });

        // Add 2 offers
        app.Offers.Add(new Offer
        {
            OfferId = Guid.NewGuid(),
            OfferVersion = 1,
            Salary = 20000000m,
            CurrencyCode = "VND",
            Status = "DECLINED"
        });
        app.Offers.Add(new Offer
        {
            OfferId = Guid.NewGuid(),
            OfferVersion = 2,
            Salary = 25000000m,
            CurrencyCode = "VND",
            Status = "SENT"
        });

        // Add 2 AI match attempts
        app.AiMatchResults.Add(new AiMatchResult
        {
            AttemptNo = 1,
            MatchScore = 75.5m,
            MatchTier = "MEDIUM",
            Status = "COMPLETED"
        });
        app.AiMatchResults.Add(new AiMatchResult
        {
            AttemptNo = 2,
            MatchScore = 88.0m,
            MatchTier = "HIGH",
            Status = "COMPLETED"
        });

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationsAsync(
                null, null, null, null, null, null, 1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(([app], 1));

        var query = new GetRecruitmentApplicationsQuery(
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        var item = result.Data.Items.Single();
        item.TotalInterviews.Should().Be(2);
        item.LatestInterviewRound.Should().Be(2);
        item.LatestInterviewStatus.Should().Be("SCHEDULED");
        item.LatestOfferStatus.Should().Be("SENT");
        item.LatestOfferSalary.Should().Be(25000000m);
        item.AiMatchScore.Should().Be(88.0m);
        item.AiMatchTier.Should().Be("HIGH");
    }

    private static Domain.Entities.Application CreateSampleApplication(Guid companyId, string status)
    {
        var company = new Company { CompanyId = companyId, CompanyName = "Tech Corp" };
        var job = new Job { JobId = Guid.NewGuid(), Title = "Senior .NET Developer", CompanyId = companyId, Company = company };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Nguyen Van A",
            Email = "vana@example.com",
            Phone = "0987654321"
        };

        return new Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = job.JobId,
            Job = job,
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            Status = status,
            AppliedAt = DateTime.UtcNow.AddDays(-7),
            ConcurrencyToken = Guid.NewGuid()
        };
    }
}
