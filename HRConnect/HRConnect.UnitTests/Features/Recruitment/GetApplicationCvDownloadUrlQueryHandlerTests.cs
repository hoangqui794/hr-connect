using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Queries.GetApplicationCvDownloadUrl;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Recruitment;

public class GetApplicationCvDownloadUrlQueryHandlerTests
{
    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<ICompanyUserRepository> _companyUsers = new();
    private readonly Mock<ICvStorageService> _storage = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly GetApplicationCvDownloadUrlQueryHandler _handler;

    private static readonly Guid CompanyId = Guid.NewGuid();
    private static readonly Guid ClientUserId = Guid.NewGuid();

    public GetApplicationCvDownloadUrlQueryHandlerTests()
    {
        _handler = new GetApplicationCvDownloadUrlQueryHandler(
            _applications.Object,
            _companyUsers.Object,
            _storage.Object,
            _audit.Object,
            _unitOfWork.Object,
            Mock.Of<ILogger<GetApplicationCvDownloadUrlQueryHandler>>());

        _companyUsers
            .Setup(r => r.GetByUserIdAsync(ClientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = ClientUserId, CompanyId = CompanyId, Status = "ACTIVE" });

        _storage
            .Setup(s => s.GetCvDownloadUrlAsync(It.IsAny<Guid>(), It.IsAny<TimeSpan?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid cvId, TimeSpan? _, CancellationToken _) => new CvDownloadUrlResult
            {
                CvId = cvId,
                FileName = "cv.pdf",
                DownloadUrl = "https://storage.example/cv.pdf?sig=1",
                ExpiresAt = DateTime.UtcNow.AddMinutes(10)
            });
    }

    private JobApplication Arrange(string serviceTypeCode, string status, bool withCv = true, Guid? companyId = null, bool placed = false)
    {
        var app = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            CandidateId = Guid.NewGuid(),
            Status = status,
            Job = new Job { CompanyId = companyId ?? CompanyId, ServiceType = new ServiceType { Code = serviceTypeCode } },
            ApplicationStatusHistories = new List<ApplicationStatusHistory>(),
            Placement = placed ? new Placement { PlacementId = Guid.NewGuid() } : null,
            Submission = withCv
                ? new Submission { CandidateCv = new CandidateCv { CvId = Guid.NewGuid(), FileName = "Nguyen_Van_A.pdf" } }
                : null!,
        };
        _applications
            .Setup(r => r.GetRecruitmentApplicationDetailAsync(app.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);
        return app;
    }

    private static GetApplicationCvDownloadUrlQuery AsClient(JobApplication app) =>
        new(app.ApplicationId, ClientUserId, IsClientCompanyUser: true, IsInternalHrOrAdmin: false);

    [Fact]
    public async Task Client_CvApplication_GetsSignedLink_AndAuditIsWritten()
    {
        var app = Arrange("CV_APPLICATION", "SUBMITTED");

        var result = await _handler.Handle(AsClient(app), CancellationToken.None);

        result.Data.DownloadUrl.Should().StartWith("https://");
        result.Data.FileName.Should().Be("Nguyen_Van_A.pdf");
        _storage.Verify(s => s.GetCvDownloadUrlAsync(app.Submission!.CandidateCv!.CvId,
            GetApplicationCvDownloadUrlQueryHandler.LinkLifetime, It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == AuditActions.ApplicationCvDownloadUrlIssued), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Client_OfAnotherCompany_IsForbidden()
    {
        var app = Arrange("CV_APPLICATION", "SUBMITTED", companyId: Guid.NewGuid());

        var act = () => _handler.Handle(AsClient(app), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
        _storage.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Client_HeadhuntBeforePlacement_IsForbidden()
    {
        var app = Arrange("HEADHUNT_COD", "SHORTLISTED");

        var act = () => _handler.Handle(AsClient(app), CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>().WithMessage("*sau khi ứng viên đi làm*");
        _storage.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Client_HeadhuntAfterPlacement_GetsLink()
    {
        var app = Arrange("HEADHUNT_COD", "PLACED", placed: true);

        var result = await _handler.Handle(AsClient(app), CancellationToken.None);

        result.Data.DownloadUrl.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Client_CvSourcingNotYetShortlisted_IsHidden()
    {
        var app = Arrange("CV_SOURCING", "SUBMITTED");

        var act = () => _handler.Handle(AsClient(app), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task InternalHr_GetsLink_ForAnyService()
    {
        var app = Arrange("HEADHUNT_COD", "SUBMITTED");

        var result = await _handler.Handle(
            new GetApplicationCvDownloadUrlQuery(app.ApplicationId, Guid.NewGuid(), IsClientCompanyUser: false, IsInternalHrOrAdmin: true),
            CancellationToken.None);

        result.Data.CvId.Should().Be(app.Submission!.CandidateCv!.CvId);
    }

    [Fact]
    public async Task ApplicationWithoutCv_ReturnsNotFound()
    {
        var app = Arrange("CV_APPLICATION", "SUBMITTED", withCv: false);

        var act = () => _handler.Handle(AsClient(app), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>().WithMessage("*không có CV*");
    }

    [Fact]
    public async Task OtherRoles_AreForbidden()
    {
        var app = Arrange("CV_APPLICATION", "SUBMITTED");

        var act = () => _handler.Handle(
            new GetApplicationCvDownloadUrlQuery(app.ApplicationId, Guid.NewGuid(), IsClientCompanyUser: false, IsInternalHrOrAdmin: false),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }
}
