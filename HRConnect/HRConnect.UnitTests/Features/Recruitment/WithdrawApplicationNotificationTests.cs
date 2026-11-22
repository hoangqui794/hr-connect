using System.Text.Json;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Services;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Recruitment.Commands.WithdrawApplication;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Recruitment;

/// <summary>
/// Who hears that a candidate withdrew: the Client Company only for an application it could already see
/// (ClientVisibilityPolicy), otherwise Internal HR. EF InMemory with the real NotificationRepository.
/// </summary>
public sealed class WithdrawApplicationNotificationTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private readonly Mock<IApplicationRepository> _applications = new();
    private readonly Mock<IUserRepository> _users = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();

    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid[] _companyMembers = [Guid.NewGuid(), Guid.NewGuid()];
    private readonly Guid[] _internalHr = [Guid.NewGuid()];

    public WithdrawApplicationNotificationTests()
    {
        _unitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Returns((CancellationToken ct) => _context.SaveChangesAsync(ct));
        _users.Setup(r => r.GetActiveUserIdsByCompanyAsync(_companyId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(_companyMembers);
        _users.Setup(r => r.GetActiveUserIdsByRoleAsync(RoleCodes.InternalHr, It.IsAny<CancellationToken>()))
            .ReturnsAsync(_internalHr);
    }

    private WithdrawApplicationCommandHandler Handler() => new(
        _applications.Object,
        _unitOfWork.Object,
        Mock.Of<IAuditLogService>(),
        new AppNotifier(_users.Object, new NotificationRepository(_context)));

    private JobApplication NewApplication(string serviceTypeCode, string status, params string[] history)
    {
        var jobId = Guid.NewGuid();
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(),
            JobId = jobId,
            Job = new Job
            {
                JobId = jobId,
                CompanyId = _companyId,
                Title = "Backend Developer",
                CreatedBy = Guid.NewGuid(),
                ServiceType = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = serviceTypeCode, Name = serviceTypeCode }
            },
            CandidateId = Guid.NewGuid(),
            Candidate = new Candidate { CandidateId = Guid.NewGuid(), UserId = Guid.NewGuid(), FullName = "Nguyễn Văn A" },
            Status = status,
            ConcurrencyToken = Guid.NewGuid(),
            ApplicationStatusHistories = history
                .Select(s => new ApplicationStatusHistory { ApplicationStatusHistoryId = Guid.NewGuid(), NewStatus = s })
                .ToList()
        };
        _applications.Setup(r => r.GetByIdAsync(application.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(application);
        return application;
    }

    private Task Withdraw(JobApplication application) =>
        Handler().Handle(new WithdrawApplicationCommand(
            application.ApplicationId, "Đã nhận công việc khác.", application.ConcurrencyToken, application.Candidate.UserId!.Value),
            CancellationToken.None);

    private List<Notification> NoticesFor(IEnumerable<Guid> users) =>
        _context.Notifications.AsNoTracking().Where(n => users.Contains(n.UserId)).ToList();

    /// <summary>routeHint as the bell reads it (the JSON escapes characters such as &amp;).</summary>
    private static string? RouteHintOf(Notification n) =>
        JsonDocument.Parse(n.Metadata).RootElement.TryGetProperty("routeHint", out var hint) ? hint.GetString() : null;

    private void ShouldNotifyCompanyOnly(JobApplication app)
    {
        var company = NoticesFor(_companyMembers);
        company.Should().HaveCount(2);
        company.Should().OnlyContain(n =>
            n.NotificationType == "APPLICATION_STATUS"
            && n.RelatedEntityType == "APPLICATION"
            && n.RelatedEntityId == app.ApplicationId
            && n.Message.Contains("Nguyễn Văn A")
            && RouteHintOf(n) == $"/client/candidates?open={app.ApplicationId}");
        NoticesFor(_internalHr).Should().BeEmpty();
    }

    private void ShouldNotifyInternalHrOnly(JobApplication app)
    {
        NoticesFor(_companyMembers).Should().BeEmpty();
        NoticesFor([app.Job.CreatedBy]).Should().BeEmpty();
        NoticesFor(_internalHr).Should().ContainSingle(n =>
            n.RelatedEntityId == app.ApplicationId
            && RouteHintOf(n) == $"/hr/screening?status=all&open={app.ApplicationId}");
    }

    [Theory]
    [InlineData(ApplicationStates.Submitted)]
    [InlineData(ApplicationStates.Screening)]
    [InlineData(ApplicationStates.Interview)]
    public async Task Cv_application_withdrawal_notifies_every_active_company_member(string status)
    {
        var app = NewApplication(ServiceTypeCodes.CvApplication, status);

        await Withdraw(app);

        ShouldNotifyCompanyOnly(app);
    }

    [Theory]
    [InlineData(ApplicationStates.Submitted)]
    [InlineData(ApplicationStates.Screening)]
    public async Task Headhunt_cod_withdrawal_before_shortlist_tells_internal_hr_not_the_client(string status)
    {
        var app = NewApplication(ServiceTypeCodes.HeadhuntCod, status);

        await Withdraw(app);

        ShouldNotifyInternalHrOnly(app);
    }

    [Fact]
    public async Task Headhunt_cod_withdrawal_after_shortlist_notifies_the_client()
    {
        var app = NewApplication(ServiceTypeCodes.HeadhuntCod, ApplicationStates.Interview, ApplicationStates.Shortlisted, ApplicationStates.Interview);

        await Withdraw(app);

        ShouldNotifyCompanyOnly(app);
    }

    [Fact]
    public async Task Cv_sourcing_withdrawal_before_delivery_tells_internal_hr_not_the_client()
    {
        var app = NewApplication(ServiceTypeCodes.CvSourcing, ApplicationStates.Shortlisted, ApplicationStates.Shortlisted);

        await Withdraw(app);

        ShouldNotifyInternalHrOnly(app);
    }

    [Fact]
    public async Task Cv_sourcing_withdrawal_after_delivery_notifies_the_client()
    {
        var app = NewApplication(ServiceTypeCodes.CvSourcing, ApplicationStates.Shortlisted, ApplicationStates.Shortlisted);
        app.SourcingDeliveries = new List<SourcingDelivery> { new() { DeliveryId = Guid.NewGuid() } };

        await Withdraw(app);

        ShouldNotifyCompanyOnly(app);
    }

    [Fact]
    public async Task Withdrawal_still_succeeds_without_a_notifier()
    {
        var app = NewApplication(ServiceTypeCodes.HeadhuntCod, ApplicationStates.Submitted);
        var handler = new WithdrawApplicationCommandHandler(_applications.Object, _unitOfWork.Object, Mock.Of<IAuditLogService>());

        var result = await handler.Handle(new WithdrawApplicationCommand(
            app.ApplicationId, null, app.ConcurrencyToken, app.Candidate.UserId!.Value), CancellationToken.None);

        result.ApplicationStatus.Should().Be(ApplicationStates.Withdrawn);
        _context.Notifications.Should().BeEmpty();
    }
}
