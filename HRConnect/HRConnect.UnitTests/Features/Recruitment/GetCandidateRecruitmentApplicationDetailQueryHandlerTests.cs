using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using HRConnect.Application.Common;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetCandidateRecruitmentApplicationDetailQueryHandlerTests
{
    private readonly Mock<IApplicationRepository> _applicationRepositoryMock = new();
    private readonly Mock<ILogger<GetCandidateRecruitmentApplicationDetailQueryHandler>> _loggerMock = new();

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }

    private GetCandidateRecruitmentApplicationDetailQueryHandler CreateHandler(
        TimeProvider? timeProvider = null,
        ICompanyUserRepository? companyUserRepository = null) =>
        new(_applicationRepositoryMock.Object, _loggerMock.Object, timeProvider, companyUserRepository);

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
                    ExpiryDate = VietnamTime.Today().AddDays(3)
                },
                new Offer
                {
                    OfferId = Guid.NewGuid(),
                    OfferVersion = 2,
                    Status = OfferStates.Sent, // SENT offer - should be included
                    Salary = 25000000,
                    CurrencyCode = "VND",
                    StartDate = VietnamTime.Today().AddDays(14),
                    ExpiryDate = VietnamTime.Today().AddDays(7),
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

    [Theory]
    [InlineData(13, false)]
    [InlineData(14, true)]
    public async Task Handle_AtEarlyMorningVietnamTime_ShouldComputeCanRespondAgainstVietnamDate(
        int expiryDay,
        bool expectedCanRespond)
    {
        var earlyMorningVn = new FixedTimeProvider(new DateTimeOffset(2026, 11, 13, 20, 34, 0, TimeSpan.Zero));
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var app = new Domain.Entities.Application
        {
            ApplicationId = appId,
            JobId = Guid.NewGuid(),
            Job = new Job
            {
                JobId = Guid.NewGuid(),
                Title = "Backend Engineer",
                CompanyId = Guid.NewGuid(),
                Company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "Tech Corp" }
            },
            CandidateId = Guid.NewGuid(),
            Candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = candidateUserId, FullName = "Nguyen Van A" },
            Status = ApplicationStates.OfferPending,
            AppliedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid(),
            Offers = new List<Offer>
            {
                new Offer
                {
                    OfferId = Guid.NewGuid(),
                    OfferVersion = 1,
                    Status = OfferStates.Sent,
                    Salary = 25000000,
                    CurrencyCode = "VND",
                    ExpiryDate = new DateOnly(2026, 11, expiryDay),
                    ConcurrencyToken = Guid.NewGuid()
                }
            }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var result = await CreateHandler(earlyMorningVn).Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        result.Data!.Offers.Should().ContainSingle();
        result.Data.Offers[0].CanRespond.Should().Be(expectedCanRespond);
    }

    private static Domain.Entities.Application CreateEmployerContactApp(
        Guid appId,
        Guid candidateUserId,
        string status,
        string companyUserStatus = "ACTIVE",
        string? website = "https://concentrix.example.com")
    {
        var companyId = Guid.NewGuid();
        return new Domain.Entities.Application
        {
            ApplicationId = appId,
            JobId = Guid.NewGuid(),
            Job = new Job
            {
                JobId = Guid.NewGuid(),
                Title = "Team Leader Telesales",
                CompanyId = companyId,
                Company = new Company
                {
                    CompanyId = companyId,
                    CompanyName = "Vietnam Concentrix Services",
                    Website = website,
                    Address = "Q.12, TP.HCM",
                    CompanyUser = new CompanyUser
                    {
                        Status = companyUserStatus,
                        RoleInCompany = "Talent Acquisition Lead",
                        User = new AppUser
                        {
                            UserId = Guid.NewGuid(),
                            DisplayName = "Nguyễn Minh HR",
                            Email = "hr@concentrix.example.com",
                            Phone = "0909123456"
                        }
                    }
                }
            },
            CandidateId = Guid.NewGuid(),
            Candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = candidateUserId, FullName = "Hoàng Thị Hà Phương" },
            Status = status,
            AppliedAt = DateTime.UtcNow.AddDays(-5),
            UpdatedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid()
        };
    }

    [Theory]
    [InlineData(ApplicationStates.OfferAccepted)]
    [InlineData(ApplicationStates.Placed)]
    public async Task Handle_WhenStatusIsOfferAcceptedOrPlacedAndCompanyUserActive_ShouldReturnEmployerContact(string status)
    {
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var app = CreateEmployerContactApp(appId, candidateUserId, status, website: "concentrix.example.com");

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var result = await CreateHandler().Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        result.Data!.EmployerContact.Should().NotBeNull();
        result.Data.EmployerContact!.ContactName.Should().Be("Nguyễn Minh HR");
        result.Data.EmployerContact.RoleInCompany.Should().Be("Talent Acquisition Lead");
        result.Data.EmployerContact.Email.Should().Be("hr@concentrix.example.com");
        result.Data.EmployerContact.Phone.Should().Be("0909123456");
        result.Data.EmployerContact.Website.Should().Be("https://concentrix.example.com");
        result.Data.EmployerContact.Address.Should().Be("Q.12, TP.HCM");
    }

    [Theory]
    [InlineData(ApplicationStates.Shortlisted)]
    [InlineData(ApplicationStates.OfferPending)]
    [InlineData(ApplicationStates.OfferDeclined)]
    public async Task Handle_WhenStatusIsBeforeOfferAccepted_ShouldNotExposeEmployerContact(string status)
    {
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var app = CreateEmployerContactApp(appId, candidateUserId, status);

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var result = await CreateHandler().Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        result.Data!.EmployerContact.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WhenCompanyUserIsNotActive_ShouldNotExposeCompanyUserEmailOrPhone()
    {
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var app = CreateEmployerContactApp(appId, candidateUserId, ApplicationStates.OfferAccepted, companyUserStatus: "INACTIVE");

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var result = await CreateHandler().Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        result.Data!.EmployerContact.Should().NotBeNull();
        result.Data.EmployerContact!.ContactName.Should().BeNull();
        result.Data.EmployerContact.RoleInCompany.Should().BeNull();
        result.Data.EmployerContact.Email.Should().BeNull();
        result.Data.EmployerContact.Phone.Should().BeNull();
        result.Data.EmployerContact.Website.Should().Be("https://concentrix.example.com");
        result.Data.EmployerContact.Address.Should().Be("Q.12, TP.HCM");
    }

    [Fact]
    public async Task Handle_WhenCompanyUserRepositoryResolvesActivePrimaryContact_ShouldUseRepositoryContactAndGateBeforeAcceptance()
    {
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var companyUserRepo = new Mock<ICompanyUserRepository>();
        var app = CreateEmployerContactApp(
            appId,
            candidateUserId,
            ApplicationStates.OfferAccepted,
            companyUserStatus: "INACTIVE",
            website: "javascript:alert(1)");

        var activePrimary = new CompanyUser
        {
            Status = "ACTIVE",
            IsPrimaryContact = true,
            RoleInCompany = "HR Director",
            User = new AppUser
            {
                UserId = Guid.NewGuid(),
                Status = "ACTIVE",
                DisplayName = "Lê Thu Hà",
                Email = "primary@concentrix.example.com",
                Phone = "0988777666"
            }
        };

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);
        companyUserRepo
            .Setup(r => r.GetPrimaryActiveByCompanyIdAsync(app.Job!.CompanyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(activePrimary);

        var acceptedResult = await CreateHandler(companyUserRepository: companyUserRepo.Object).Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        acceptedResult.Data!.EmployerContact.Should().NotBeNull();
        acceptedResult.Data.EmployerContact!.ContactName.Should().Be("Lê Thu Hà");
        acceptedResult.Data.EmployerContact.RoleInCompany.Should().Be("HR Director");
        acceptedResult.Data.EmployerContact.Email.Should().Be("primary@concentrix.example.com");
        acceptedResult.Data.EmployerContact.Phone.Should().Be("0988777666");
        acceptedResult.Data.EmployerContact.Website.Should().BeNull();

        app.Status = ApplicationStates.Shortlisted;
        var shortlistedResult = await CreateHandler(companyUserRepository: companyUserRepo.Object).Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        shortlistedResult.Data!.EmployerContact.Should().BeNull();
        companyUserRepo.Verify(
            r => r.GetPrimaryActiveByCompanyIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_WhenCompanyUserAppUserStatusIsInactive_ShouldNotExposeUserContact()
    {
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var app = CreateEmployerContactApp(appId, candidateUserId, ApplicationStates.Placed, companyUserStatus: "ACTIVE");
        app.Job!.Company!.CompanyUser!.User.Status = "INACTIVE";

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);

        var result = await CreateHandler().Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        result.Data!.EmployerContact.Should().NotBeNull();
        result.Data.EmployerContact!.ContactName.Should().BeNull();
        result.Data.EmployerContact.Email.Should().BeNull();
        result.Data.EmployerContact.Phone.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WhenResolvedFromDependencyInjectionWithoutTimeProvider_ShouldInjectCompanyUserRepository()
    {
        var appId = Guid.NewGuid();
        var candidateUserId = Guid.NewGuid();
        var companyUserRepo = new Mock<ICompanyUserRepository>();
        var app = CreateEmployerContactApp(appId, candidateUserId, ApplicationStates.OfferAccepted, companyUserStatus: "INACTIVE");

        _applicationRepositoryMock
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(appId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);
        companyUserRepo
            .Setup(r => r.GetPrimaryActiveByCompanyIdAsync(app.Job!.CompanyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser
            {
                Status = "ACTIVE",
                IsPrimaryContact = true,
                RoleInCompany = "Talent Partner",
                User = new AppUser
                {
                    UserId = Guid.NewGuid(),
                    Status = "ACTIVE",
                    DisplayName = "DI Resolved Contact",
                    Email = "di@concentrix.example.com",
                    Phone = "0911222333"
                }
            });

        var services = new ServiceCollection();
        services.AddSingleton(_applicationRepositoryMock.Object);
        services.AddSingleton(_loggerMock.Object);
        services.AddSingleton(companyUserRepo.Object);
        services.AddTransient<GetCandidateRecruitmentApplicationDetailQueryHandler>();

        using var provider = services.BuildServiceProvider();
        var handler = provider.GetRequiredService<GetCandidateRecruitmentApplicationDetailQueryHandler>();

        var result = await handler.Handle(
            new GetCandidateRecruitmentApplicationDetailQuery(appId, candidateUserId),
            CancellationToken.None);

        result.Data!.EmployerContact.Should().NotBeNull();
        result.Data.EmployerContact!.ContactName.Should().Be("DI Resolved Contact");
        result.Data.EmployerContact.Email.Should().Be("di@concentrix.example.com");
    }
}
