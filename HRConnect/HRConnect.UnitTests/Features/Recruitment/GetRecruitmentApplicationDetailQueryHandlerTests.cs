using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetRecruitmentApplicationDetailQueryHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepositoryMock = new();
    private readonly Mock<ILogger<GetRecruitmentApplicationDetailQueryHandler>> _loggerMock = new();

    private GetRecruitmentApplicationDetailQueryHandler CreateHandler() =>
        new(_applicationRepositoryMock.Object, _companyUserRepositoryMock.Object, _loggerMock.Object);

    [Fact]
    public async Task Handle_WhenApplicationNotFound_ShouldThrowNotFoundException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Domain.Entities.Application?)null);

        var query = new GetRecruitmentApplicationDetailQuery(
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

        var app = CreateSampleApplication(appId, companyA, "SUBMITTED");
        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyB });

        var query = new GetRecruitmentApplicationDetailQuery(
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
    public async Task Handle_WhenClientCompanyUserFromSameCompany_ShouldReturnDetailSuccessfully()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var app = CreateSampleApplication(appId, companyA, "INTERVIEW");
        app.Interviews.Add(new Interview
        {
            InterviewId = Guid.NewGuid(),
            InterviewRound = 1,
            Status = "SCHEDULED",
            ScheduledAt = DateTime.UtcNow.AddDays(-1)
        });

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyA });

        var query = new GetRecruitmentApplicationDetailQuery(
            ApplicationId: appId,
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.ApplicationId.Should().Be(appId);
        result.Data.CompanyId.Should().Be(companyA);
        result.Data.Interviews.Should().HaveCount(1);
        result.Data.AllowedActions.Should().Contain("RECORD_INTERVIEW_RESULT");
        result.Data.AllowedActions.Should().Contain("RESCHEDULE_INTERVIEW");
    }

    [Fact]
    public async Task Handle_WhenInternalHrOrAdmin_ShouldReturnReadOnlyDetailForAnyCompany()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var companyA = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var app = CreateSampleApplication(appId, companyA, "OFFER_PENDING");
        app.Offers.Add(new Offer
        {
            OfferId = Guid.NewGuid(),
            OfferVersion = 1,
            Salary = 30000000m,
            Status = "SENT"
        });

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetRecruitmentApplicationDetailQuery(
            ApplicationId: appId,
            UserId: userId,
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: true
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.ApplicationId.Should().Be(appId);
        result.Data.Offers.Should().HaveCount(1);
        result.Data.AllowedActions.Should().BeEmpty();
        _companyUserRepositoryMock.Verify(r => r.GetByUserIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ProjectsSafeAiDiagnosticsAndSurvivesMalformedLegacyJson()
    {
        var appId = Guid.NewGuid();
        var app = CreateSampleApplication(appId, Guid.NewGuid(), "SUBMITTED");
        app.AiMatchResults.Add(new AiMatchResult
        {
            MatchResultId = Guid.NewGuid(),
            ApplicationId = appId,
            AttemptNo = 1,
            Status = "COMPLETED",
            RawResponse = """
                {
                  "parseConfidence": 0.55,
                  "requiresManualReview": true,
                  "semanticScore": 0.42,
                  "warnings": ["EXPERIENCE_EVIDENCE_UNRESOLVED"],
                  "diagnostics": [{"code":"EXPERIENCE_EVIDENCE_UNRESOLVED","category":"MISSING_EVIDENCE","field":"experience"}],
                  "missingRequirements": ["Experience could not be verified"],
                  "matchingReasons": ["Manual review is required"],
                  "inputFingerprints": {"cvSha256":"abc","jdSha256":"def"}
                }
                """
        });
        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var result = await CreateHandler().Handle(new GetRecruitmentApplicationDetailQuery(
            appId, Guid.NewGuid(), false, true), CancellationToken.None);

        result.Data.AiMatch.Should().NotBeNull();
        result.Data.AiMatch!.ParseConfidence.Should().Be(0.55m);
        result.Data.AiMatch.RequiresManualReview.Should().BeTrue();
        result.Data.AiMatch.Diagnostics.Should().ContainSingle()
            .Which.Field.Should().Be("experience");
        result.Data.AiMatch.InputFingerprints!.JdSha256.Should().Be("def");

        app.AiMatchResults.Single().RawResponse = "{ malformed";
        var malformed = await CreateHandler().Handle(new GetRecruitmentApplicationDetailQuery(
            appId, Guid.NewGuid(), false, true), CancellationToken.None);
        malformed.Data.AiMatch!.Diagnostics.Should().BeEmpty();
        malformed.Data.AiMatch.RequiresManualReview.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WhenUserHasNeitherRole_ShouldThrowForbiddenException()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var app = CreateSampleApplication(appId, Guid.NewGuid(), "SUBMITTED");

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var query = new GetRecruitmentApplicationDetailQuery(
            ApplicationId: appId,
            UserId: Guid.NewGuid(),
            IsClientCompanyUser: false,
            IsInternalHrOrAdmin: false
        );

        // Act
        var act = () => CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("Bạn không có quyền xem chi tiết hồ sơ tuyển dụng.");
    }

    [Fact]
    public async Task Handle_WhenCompanyUserViewsInterviewPass_AllowedActionsShouldIncludeCreateOffer()
    {
        // Arrange
        var appId = Guid.NewGuid();
        var companyId = Guid.NewGuid();
        var app = CreateSampleApplication(appId, companyId, "OFFER_PENDING");
        app.Interviews.Add(new Interview
        {
            InterviewId = Guid.NewGuid(),
            InterviewRound = 1,
            Status = "COMPLETED",
            Result = "PASS"
        });

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var userId = Guid.NewGuid();
        _companyUserRepositoryMock
            .Setup(r => r.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = userId, CompanyId = companyId });

        var query = new GetRecruitmentApplicationDetailQuery(
            ApplicationId: appId,
            UserId: userId,
            IsClientCompanyUser: true,
            IsInternalHrOrAdmin: false
        );

        // Act
        var result = await CreateHandler().Handle(query, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.AllowedActions.Should().Contain("CREATE_OFFER");
    }

    private static Domain.Entities.Application CreateSampleApplication(Guid applicationId, Guid companyId, string status)
    {
        var company = new Company { CompanyId = companyId, CompanyName = "Tech Corp" };
        var job = new Job { JobId = Guid.NewGuid(), Title = "Backend Lead", CompanyId = companyId, Company = company };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Tran Thi B",
            Email = "thib@example.com",
            Phone = "0912345678"
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
            UpdatedAt = DateTime.UtcNow.AddDays(-2),
            ConcurrencyToken = Guid.NewGuid()
        };
    }
}
