using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Microsoft.Extensions.Logging;
using Moq;

namespace HRConnect.UnitTests.Features.Recruitment;

/// <summary>MF-03 rules on the application detail: Client visibility, contact masking, screening actions.</summary>
public sealed class GetRecruitmentApplicationDetailMf03Tests
{
    private readonly Mock<IApplicationRepository> _applicationRepository = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepository = new();
    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();

    public GetRecruitmentApplicationDetailMf03Tests()
    {
        _companyUserRepository.Setup(r => r.GetByUserIdAsync(_clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = _clientUserId, CompanyId = _companyId, Status = "ACTIVE" });
    }

    private GetRecruitmentApplicationDetailQueryHandler CreateHandler() => new(
        _applicationRepository.Object,
        _companyUserRepository.Object,
        Mock.Of<ILogger<GetRecruitmentApplicationDetailQueryHandler>>());

    [Theory]
    [InlineData("HEADHUNT_COD", "SUBMITTED")]
    [InlineData("CV_SOURCING", "SCREENING")]
    [InlineData("CV_SOURCING", "REJECTED")]
    public async Task Client_WhenPlatformScreenedApplicationNotShortlisted_ShouldNotFind(string serviceType, string status)
    {
        var app = Setup(serviceType, status);

        var act = () => CreateHandler().Handle(ClientQuery(app), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Client_WhenHeadhuntShortlisted_ShouldSeeItWithContactMasked()
    {
        var app = Setup("HEADHUNT_COD", ApplicationStates.Shortlisted);

        var result = await CreateHandler().Handle(ClientQuery(app), CancellationToken.None);

        result.Data.CandidateFullName.Should().Be("Tran Thi B");
        result.Data.CandidateEmail.Should().BeNull();
        result.Data.CandidatePhone.Should().BeNull();
        result.Data.CurrentAddress.Should().BeNull();
        result.Data.Cv!.FileUrl.Should().BeNull();
        result.Data.IsContactMasked.Should().BeTrue();
        result.Data.ContactOwner.Should().Be(nameof(ContactOwner.InternalHr));
        result.Data.AllowedActions.Should().Contain("SCHEDULE_INTERVIEW")
            .And.NotContain(["SHORTLIST", "REJECT"]);
    }

    [Fact]
    public async Task Client_WhenHeadhuntPlaced_ShouldSeeContact()
    {
        var app = Setup("HEADHUNT_COD", ApplicationStates.Placed);

        var result = await CreateHandler().Handle(ClientQuery(app), CancellationToken.None);

        result.Data.CandidateEmail.Should().Be("thib@example.com");
        result.Data.Cv!.FileUrl.Should().Be("https://files.example/cv.pdf");
        result.Data.IsContactMasked.Should().BeFalse();
    }

    [Fact]
    public async Task Client_WhenCvSourcingShortlisted_ShouldSeeContactBecauseClientContactsCandidate()
    {
        var app = Setup("CV_SOURCING", ApplicationStates.Shortlisted);

        var result = await CreateHandler().Handle(ClientQuery(app), CancellationToken.None);

        result.Data.CandidatePhone.Should().Be("0912345678");
        result.Data.ContactOwner.Should().Be(nameof(ContactOwner.ClientCompany));
    }

    [Fact]
    public async Task Client_WhenCvApplicationSubmitted_ShouldSeeScreeningActions()
    {
        var app = Setup("CV_APPLICATION", ApplicationStates.Submitted);

        var result = await CreateHandler().Handle(ClientQuery(app), CancellationToken.None);

        result.Data.AllowedActions.Should().Contain(["START_SCREENING", "SHORTLIST", "REJECT", "MARK_BACKUP"]);
    }

    [Fact]
    public async Task InternalHr_WhenHeadhuntSubmitted_ShouldSeeScreeningActionsAndFullContact()
    {
        var app = Setup("HEADHUNT_COD", ApplicationStates.Submitted);

        var result = await CreateHandler().Handle(
            new GetRecruitmentApplicationDetailQuery(app.ApplicationId, Guid.NewGuid(), false, true, ScreeningActor.InternalHr),
            CancellationToken.None);

        result.Data.AllowedActions.Should().BeEquivalentTo(["START_SCREENING", "SHORTLIST", "REJECT"]);
        result.Data.CandidateEmail.Should().Be("thib@example.com");
        result.Data.IsContactMasked.Should().BeFalse();
    }

    [Fact]
    public async Task InternalHr_WhenCvApplicationSubmitted_ShouldNotSeeScreeningActions()
    {
        var app = Setup("CV_APPLICATION", ApplicationStates.Submitted);

        var result = await CreateHandler().Handle(
            new GetRecruitmentApplicationDetailQuery(app.ApplicationId, Guid.NewGuid(), false, true, ScreeningActor.InternalHr),
            CancellationToken.None);

        result.Data.AllowedActions.Should().BeEmpty();
    }

    private GetRecruitmentApplicationDetailQuery ClientQuery(HRConnect.Domain.Entities.Application app) =>
        new(app.ApplicationId, _clientUserId, IsClientCompanyUser: true, IsInternalHrOrAdmin: false, ScreeningActor.ClientCompany);

    private HRConnect.Domain.Entities.Application Setup(string serviceType, string status)
    {
        var job = new Job
        {
            JobId = Guid.NewGuid(),
            Title = "Backend Lead",
            CompanyId = _companyId,
            Company = new Company { CompanyId = _companyId, CompanyName = "Tech Corp" },
            ServiceType = new ServiceType { Code = serviceType, Name = serviceType }
        };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(),
            FullName = "Tran Thi B",
            Email = "thib@example.com",
            Phone = "0912345678",
            CurrentAddress = "Ha Noi"
        };
        var app = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(),
            JobId = job.JobId,
            Job = job,
            CandidateId = candidate.CandidateId,
            Candidate = candidate,
            Status = status,
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            ConcurrencyToken = Guid.NewGuid(),
            Submission = new Submission
            {
                CandidateCv = new CandidateCv { CvId = Guid.NewGuid(), Title = "CV", SourceFileUrl = "https://files.example/cv.pdf" }
            }
        };
        _applicationRepository.Setup(r => r.GetRecruitmentApplicationDetailAsync(app.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(app);
        return app;
    }
}
