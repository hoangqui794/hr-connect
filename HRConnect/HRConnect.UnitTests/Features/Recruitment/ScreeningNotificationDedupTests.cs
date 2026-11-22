using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Services;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Recruitment.Commands.UpdateApplicationScreeningStatus;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Recruitment;

/// <summary>
/// BE-M02: screening notices are de-duplicated per target status (not per application), and the
/// Client Company hears about a HEADHUNT_COD shortlist. Runs on EF InMemory with the real
/// NotificationRepository so the metadata is stored and read back like in production.
/// </summary>
public sealed class ScreeningNotificationDedupTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<ICompanyUserRepository> _companyUsers = new();
    private readonly Mock<IServiceTypeRepository> _serviceTypes = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _audit = new();

    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();
    private readonly Guid[] _companyMembers = [Guid.NewGuid(), Guid.NewGuid()];

    public ScreeningNotificationDedupTests()
    {
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken ct) => _context.SaveChangesAsync(ct));
        _companyUsers.Setup(r => r.GetByUserIdAsync(_clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { UserId = _clientUserId, CompanyId = _companyId, Status = "ACTIVE" });
        _users.Setup(r => r.GetActiveUserIdsByCompanyAsync(_companyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(_companyMembers);
    }

    private UpdateApplicationScreeningStatusCommandHandler Handler()
    {
        var notifications = new NotificationRepository(_context);
        return new UpdateApplicationScreeningStatusCommandHandler(
            _applications.Object,
            _companyUsers.Object,
            _serviceTypes.Object,
            notifications,
            _unitOfWork.Object,
            _audit.Object,
            Mock.Of<ILogger<UpdateApplicationScreeningStatusCommandHandler>>(),
            new AppNotifier(_users.Object, notifications));
    }

    private JobApplication NewApplication(string serviceTypeCode, string status, bool withAffiliate = true)
    {
        var jobId = Guid.NewGuid();
        var serviceType = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = serviceTypeCode, Name = serviceTypeCode };
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            JobId = jobId,
            Job = new Job
            {
                JobId = jobId,
                CompanyId = _companyId,
                Title = "Backend Developer",
                ServiceTypeId = serviceType.ServiceTypeId,
                ServiceType = serviceType
            },
            CandidateId = Guid.NewGuid(),
            Candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = Guid.NewGuid(), FullName = "Nguyễn Văn A" },
            Attribution = withAffiliate
                ? new Attribution { Affiliate = new AffiliateProfile { AffiliateId = Guid.NewGuid(), UserId = Guid.NewGuid() } }
                : null,
            Status = status,
            ConcurrencyToken = Guid.NewGuid(),
            AppliedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _applications.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        return application;
    }

    private Task Screen(JobApplication application, string target, ScreeningActor actor, Guid userId) =>
        Handler().Handle(new UpdateApplicationScreeningStatusCommand(
            application.JobId,
            application.ApplicationId,
            target,
            null,
            target == ApplicationStates.Rejected ? ApplicationReasonCodes.ScreeningRejectionCodes[0] : null,
            application.ConcurrencyToken,
            userId,
            actor), CancellationToken.None);

    /// <summary>Shortlisted → interview held but candidate did not show up: the Client may now reject.</summary>
    private static void MoveToInterviewNoShow(JobApplication application)
    {
        application.Status = ApplicationStates.Interview;
        application.Interviews.Clear();
        application.Interviews.Add(new Interview
        {
            InterviewId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            InterviewRound = 1,
            Status = InterviewStates.NoShow,
            CreatedAt = DateTime.UtcNow
        });
    }

    private List<Notification> ScreeningNoticesFor(Guid userId, Guid applicationId) =>
        _context.Notifications.AsNoTracking()
            .Where(n => n.UserId == userId
                && n.NotificationType == ApplicationScreeningNotificationFactory.NotificationType
                && n.RelatedEntityType == "APPLICATION"
                && n.RelatedEntityId == applicationId)
            .ToList();

    private int StatusNoticeCount(Guid userId, Guid applicationId, string status) =>
        ScreeningNoticesFor(userId, applicationId)
            .Count(n => ApplicationScreeningNotificationFactory.IsAboutStatus(n.Metadata, status));

    [Fact]
    public async Task Shortlisted_then_rejected_notifies_candidate_and_affiliate_of_both()
    {
        var app = NewApplication(ServiceTypeCodes.HeadhuntCod, ApplicationStates.Screening);
        var candidate = app.Candidate.UserId!.Value;
        var affiliate = app.Attribution!.Affiliate.UserId;

        await Screen(app, ApplicationStates.Shortlisted, ScreeningActor.InternalHr, Guid.NewGuid());
        MoveToInterviewNoShow(app);
        await Screen(app, ApplicationStates.Rejected, ScreeningActor.ClientCompany, _clientUserId);

        foreach (var user in new[] { candidate, affiliate })
        {
            StatusNoticeCount(user, app.ApplicationId, ApplicationStates.Shortlisted).Should().Be(1);
            StatusNoticeCount(user, app.ApplicationId, ApplicationStates.Rejected).Should().Be(1);
        }
    }

    [Fact]
    public async Task Repeating_rejected_does_not_duplicate_the_notice()
    {
        var app = NewApplication(ServiceTypeCodes.HeadhuntCod, ApplicationStates.Screening);
        var candidate = app.Candidate.UserId!.Value;
        var affiliate = app.Attribution!.Affiliate.UserId;

        await Screen(app, ApplicationStates.Shortlisted, ScreeningActor.InternalHr, Guid.NewGuid());
        MoveToInterviewNoShow(app);
        await Screen(app, ApplicationStates.Rejected, ScreeningActor.ClientCompany, _clientUserId);
        // The same rejection again (e.g. a retried request after the status was put back).
        MoveToInterviewNoShow(app);
        await Screen(app, ApplicationStates.Rejected, ScreeningActor.ClientCompany, _clientUserId);

        StatusNoticeCount(candidate, app.ApplicationId, ApplicationStates.Rejected).Should().Be(1);
        StatusNoticeCount(affiliate, app.ApplicationId, ApplicationStates.Rejected).Should().Be(1);
        ScreeningNoticesFor(candidate, app.ApplicationId).Should().HaveCount(2);
    }

    [Fact]
    public async Task Rejected_directly_from_screening_notifies_once_each()
    {
        var app = NewApplication(ServiceTypeCodes.HeadhuntCod, ApplicationStates.Screening);

        await Screen(app, ApplicationStates.Rejected, ScreeningActor.InternalHr, Guid.NewGuid());

        StatusNoticeCount(app.Candidate.UserId!.Value, app.ApplicationId, ApplicationStates.Rejected).Should().Be(1);
        StatusNoticeCount(app.Attribution!.Affiliate.UserId, app.ApplicationId, ApplicationStates.Rejected).Should().Be(1);
        _context.Notifications.Count(n => _companyMembers.Contains(n.UserId)).Should().Be(0);
    }

    [Fact]
    public async Task Headhunt_cod_shortlist_by_internal_hr_notifies_every_active_company_member()
    {
        var app = NewApplication(ServiceTypeCodes.HeadhuntCod, ApplicationStates.Submitted);

        await Screen(app, ApplicationStates.Shortlisted, ScreeningActor.InternalHr, Guid.NewGuid());

        var companyNotices = _context.Notifications.AsNoTracking().Where(n => _companyMembers.Contains(n.UserId)).ToList();
        companyNotices.Should().HaveCount(2);
        companyNotices.Should().OnlyContain(n =>
            n.NotificationType == ApplicationScreeningNotificationFactory.NotificationType
            && n.RelatedEntityType == "APPLICATION"
            && n.RelatedEntityId == app.ApplicationId
            && n.Message.Contains("Nguyễn Văn A")
            && n.Message.Contains("Backend Developer")
            && n.Metadata.Contains($"/client/candidates?open={app.ApplicationId}"));
    }

    [Fact]
    public async Task Cv_application_shortlist_by_the_client_sends_no_company_notice()
    {
        var app = NewApplication(ServiceTypeCodes.CvApplication, ApplicationStates.Submitted, withAffiliate: false);

        await Screen(app, ApplicationStates.Shortlisted, ScreeningActor.ClientCompany, _clientUserId);

        _context.Notifications.Count(n => _companyMembers.Contains(n.UserId)).Should().Be(0);
        StatusNoticeCount(app.Candidate.UserId!.Value, app.ApplicationId, ApplicationStates.Shortlisted).Should().Be(1);
    }

    [Fact]
    public async Task Cv_sourcing_shortlist_sends_no_company_notice_here()
    {
        // CV_SOURCING tells the Client when the CV is delivered (SourcingDeliveryFeatures), not at shortlist.
        var app = NewApplication(ServiceTypeCodes.CvSourcing, ApplicationStates.Submitted);

        await Screen(app, ApplicationStates.Shortlisted, ScreeningActor.InternalHr, Guid.NewGuid());

        _context.Notifications.Count(n => _companyMembers.Contains(n.UserId)).Should().Be(0);
    }

    [Theory]
    [InlineData("{\"applicationId\":\"a\",\"jobId\":\"b\",\"status\":\"SHORTLISTED\"}", "SHORTLISTED", true)]
    [InlineData("{\"applicationId\":\"a\",\"jobId\":\"b\",\"status\":\"SHORTLISTED\"}", "REJECTED", false)]
    [InlineData("{\"Status\":\"rejected\"}", "REJECTED", true)]
    [InlineData("{\"routeHint\":\"/client/candidates\"}", "SHORTLISTED", false)]
    [InlineData("not json", "SHORTLISTED", false)]
    [InlineData("", "SHORTLISTED", false)]
    [InlineData(null, "SHORTLISTED", false)]
    public void IsAboutStatus_reads_the_status_written_by_the_factory(string? metadata, string status, bool expected) =>
        ApplicationScreeningNotificationFactory.IsAboutStatus(metadata, status).Should().Be(expected);
}
