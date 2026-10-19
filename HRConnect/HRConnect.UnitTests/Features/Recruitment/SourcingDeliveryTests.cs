using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Sourcing;
using HRConnect.Application.Features.Settings;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Recruitment;

public class SourcingDeliveryTests
{
    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<ICompanyUserRepository> _companyUsers = new();
    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();
    private readonly Guid _hrUserId = Guid.NewGuid();

    public SourcingDeliveryTests()
    {
        _companyUsers.Setup(r => r.GetByUserIdAsync(_clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyUserId = Guid.NewGuid(), CompanyId = _companyId, UserId = _clientUserId, Status = "ACTIVE" });
    }

    private SourcingDeliveryRepository Repository => new(_context);
    private UnitOfWork UnitOfWork => new(_context);
    private BusinessSettingsService Settings => new(new SystemSettingRepository(_context));

    private DeliverSourcingCvsCommandHandler Deliver() => new(Repository, Settings, UnitOfWork, _audit.Object);
    private DecideSourcingDeliveryCommandHandler Decide() => new(Repository, _companyUsers.Object, UnitOfWork, _audit.Object);
    private ReplaceSourcingDeliveryCommandHandler Replace() => new(Repository, Settings, UnitOfWork, _audit.Object);
    private ReviewSourcingRejectionCommandHandler ReviewRejection() => new(Repository, UnitOfWork, _audit.Object);
    private GetSourcingDeliveriesQueryHandler List() => new(Repository, _companyUsers.Object);
    private SourcingAutoAcceptService AutoAccept() => new(Repository, UnitOfWork, _audit.Object);

    // ---- setup ---------------------------------------------------------------------------

    private Job SeedJob(int sourcingTarget = 2, string serviceType = "CV_SOURCING", string status = "ACTIVE")
    {
        var now = DateTime.UtcNow;
        var type = new ServiceType { ServiceTypeId = Guid.NewGuid(), Code = serviceType, Name = serviceType, IsActive = true, CreatedAt = now, UpdatedAt = now };
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = _companyId, ServiceTypeId = type.ServiceTypeId, ServiceType = type, CreatedBy = Guid.NewGuid(),
            Title = "Senior .NET Developer", CurrencyCode = "VND", Quantity = 1, Status = status,
            SourcingTarget = sourcingTarget, CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        _context.AddRange(type, job);
        _context.SaveChanges();
        return job;
    }

    private JobApplication SeedApplication(Job job, string status = ApplicationStates.Shortlisted, string consent = "CONFIRMED")
    {
        var now = DateTime.UtcNow;
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(), FullName = "Nguyễn Văn A", ProfileVisibility = "PRIVATE", Status = "ACTIVE", CreatedAt = now, UpdatedAt = now,
        };
        var submission = new Submission
        {
            SubmissionId = Guid.NewGuid(), CandidateId = candidate.CandidateId, CvId = Guid.NewGuid(), JobId = job.JobId,
            SubmittedBy = Guid.NewGuid(), Source = "AFFILIATE", Status = "ACCEPTED", SubmittedAt = now, UpdatedAt = now,
        };
        submission.Consent = new SubmissionConsent
        {
            ConsentId = Guid.NewGuid(), SubmissionId = submission.SubmissionId, RecipientEmail = "a@example.com", TokenHash = "x",
            Status = consent, RequestedAt = now, ExpiresAt = now.AddDays(3), CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = candidate.CandidateId, Status = status,
            AcceptedSubmissionId = submission.SubmissionId, Submission = submission, Candidate = candidate,
            AppliedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        _context.AddRange(candidate, submission, application);
        _context.SaveChanges();
        return application;
    }

    private async Task<SourcingDeliveryDto> DeliverOneAsync(Job job, JobApplication application) =>
        (await Deliver().Handle(new DeliverSourcingCvsCommand(job.JobId, [application.ApplicationId], _hrUserId), default)).Delivered.Single();

    // ---- deliver -------------------------------------------------------------------------

    [Fact]
    public async Task Deliver_ShouldOpenSevenDayReviewWindow()
    {
        var job = SeedJob();
        var application = SeedApplication(job);

        var result = await Deliver().Handle(new DeliverSourcingCvsCommand(job.JobId, [application.ApplicationId], _hrUserId), default);

        var delivered = result.Delivered.Single();
        delivered.Status.Should().Be(SourcingDeliveryStates.Delivered);
        (delivered.ReviewDueAt - delivered.DeliveredAt).Should().Be(TimeSpan.FromDays(7));
        result.Summary.Delivered.Should().Be(1);
        result.Summary.SourcingTarget.Should().Be(2);
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == SourcingDeliveryAudit.Delivered), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Deliver_BeyondSourcingTarget_ShouldBeRejected()
    {
        var job = SeedJob(sourcingTarget: 1);
        var first = SeedApplication(job);
        var second = SeedApplication(job);

        var act = () => Deliver().Handle(new DeliverSourcingCvsCommand(job.JobId, [first.ApplicationId, second.ApplicationId], _hrUserId), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("SOURCING_TARGET_REACHED");
    }

    [Fact]
    public async Task Deliver_WithoutConfirmedConsent_ShouldBeRejected()
    {
        var job = SeedJob();
        var application = SeedApplication(job, consent: "PENDING");

        var act = () => DeliverOneAsync(job, application);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("CONSENT_NOT_CONFIRMED");
    }

    [Fact]
    public async Task Deliver_NotShortlisted_ShouldBeRejected()
    {
        var job = SeedJob();
        var application = SeedApplication(job, status: ApplicationStates.Screening);

        var act = () => DeliverOneAsync(job, application);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("APPLICATION_NOT_QUALIFIED");
    }

    [Fact]
    public async Task Deliver_ForNonSourcingJob_ShouldBeRejected()
    {
        var job = SeedJob(serviceType: "HEADHUNT_COD");
        var application = SeedApplication(job);

        var act = () => DeliverOneAsync(job, application);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("JOB_NOT_SOURCING");
    }

    [Fact]
    public async Task Deliver_SameApplicationTwice_ShouldBeRejected()
    {
        var job = SeedJob();
        var application = SeedApplication(job);
        await DeliverOneAsync(job, application);

        var act = () => DeliverOneAsync(job, application);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("APPLICATION_ALREADY_DELIVERED");
    }

    // ---- client decision -----------------------------------------------------------------

    [Fact]
    public async Task Client_Accept_ShouldCountTheCv()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));

        var result = await Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "ACCEPTED", null, null, _clientUserId), default);

        result.Status.Should().Be(SourcingDeliveryStates.Accepted);
        var list = await List().Handle(new GetSourcingDeliveriesQuery(job.JobId, _clientUserId, null), default);
        list.Summary.Counted.Should().Be(1);
    }

    [Fact]
    public async Task Client_RejectWithoutReason_ShouldBeRejected()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));

        var act = () => Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "REJECTED", null, null, _clientUserId), default);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Client_RejectAsNotChosenForInterview_ShouldNotBeAValidReason()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));

        var act = () => Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "REJECTED", "NOT_SELECTED", null, _clientUserId), default);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Client_RejectOtherWithoutNote_ShouldBeRejected()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));

        var act = () => Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "REJECTED", "OTHER", "  ", _clientUserId), default);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Client_OfAnotherCompany_ShouldNotSeeTheDelivery()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));
        var stranger = Guid.NewGuid();
        _companyUsers.Setup(r => r.GetByUserIdAsync(stranger, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser { CompanyUserId = Guid.NewGuid(), CompanyId = Guid.NewGuid(), UserId = stranger, Status = "ACTIVE" });

        var act = () => Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "ACCEPTED", null, null, stranger), default);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Client_DecidingAfterTheWindow_ShouldBeRejected()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));
        var row = await _context.SourcingDeliveries.SingleAsync(d => d.DeliveryId == delivered.DeliveryId);
        row.ReviewDueAt = DateTime.UtcNow.AddMinutes(-1);
        await _context.SaveChangesAsync();

        var act = () => Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "ACCEPTED", null, null, _clientUserId), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("REVIEW_WINDOW_CLOSED");
    }

    // ---- auto-accept ---------------------------------------------------------------------

    [Fact]
    public async Task AutoAccept_AfterTheWindow_ShouldCountTheCv()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));

        var early = await AutoAccept().AutoAcceptAsync(delivered.DeliveryId, DateTime.UtcNow.AddDays(6));
        var late = await AutoAccept().AutoAcceptAsync(delivered.DeliveryId, DateTime.UtcNow.AddDays(8));

        early.Should().BeFalse();
        late.Should().BeTrue();
        (await _context.SourcingDeliveries.SingleAsync()).Status.Should().Be(SourcingDeliveryStates.AutoAccepted);
        _audit.Verify(a => a.AddAsync(It.Is<AuditEntry>(e => e.Action == SourcingDeliveryAudit.AutoAccepted), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DueForAutoAccept_ShouldOnlyListUndecidedDeliveriesPastTheWindow()
    {
        var job = SeedJob();
        var waiting = await DeliverOneAsync(job, SeedApplication(job));
        var decided = await DeliverOneAsync(job, SeedApplication(job));
        await Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, decided.DeliveryId, "ACCEPTED", null, null, _clientUserId), default);

        var due = await Repository.GetDueForAutoAcceptAsync(DateTime.UtcNow.AddDays(8), 100);

        due.Should().ContainSingle().Which.Should().Be(waiting.DeliveryId);
    }

    // ---- rejection review and replacement ------------------------------------------------

    [Fact]
    public async Task HrOverrulingARejection_ShouldCountTheCvAsAccepted()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));
        await Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "REJECTED", "OTHER", "Không hợp", _clientUserId), default);

        var result = await ReviewRejection().Handle(new ReviewSourcingRejectionCommand(job.JobId, delivered.DeliveryId, false, "Lý do không hợp lệ", _hrUserId), default);

        result.Status.Should().Be(SourcingDeliveryStates.Accepted);
    }

    [Fact]
    public async Task Replace_ShouldSwapARejectedCvForAnotherQualifiedOne()
    {
        var job = SeedJob(sourcingTarget: 1);
        var delivered = await DeliverOneAsync(job, SeedApplication(job));
        await Decide().Handle(new DecideSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, "REJECTED", "UNREACHABLE", null, _clientUserId), default);
        var backup = SeedApplication(job);

        var replacement = await Replace().Handle(new ReplaceSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, backup.ApplicationId, _hrUserId), default);

        replacement.Status.Should().Be(SourcingDeliveryStates.Delivered);
        replacement.ApplicationId.Should().Be(backup.ApplicationId);
        var old = await _context.SourcingDeliveries.SingleAsync(d => d.DeliveryId == delivered.DeliveryId);
        old.Status.Should().Be(SourcingDeliveryStates.Replaced);
        old.ReplacedByDeliveryId.Should().Be(replacement.DeliveryId);
    }

    [Fact]
    public async Task Replace_AnUndecidedCv_ShouldBeRejected()
    {
        var job = SeedJob();
        var delivered = await DeliverOneAsync(job, SeedApplication(job));

        var act = () => Replace().Handle(new ReplaceSourcingDeliveryCommand(job.JobId, delivered.DeliveryId, SeedApplication(job).ApplicationId, _hrUserId), default);

        (await act.Should().ThrowAsync<ConflictException>()).Which.ErrorCode.Should().Be("DELIVERY_NOT_REJECTED");
    }

    // MF-03 C3: the Client list shows a CV_SOURCING application only after Internal HR delivered it.
    [Fact]
    public async Task ClientList_ShouldHideShortlistedButUndeliveredSourcingCvs()
    {
        _context.Add(new Company { CompanyId = _companyId, CompanyName = "Tech Corp", TaxCode = "0123456789", VerificationStatus = "VERIFIED" });
        var job = SeedJob();
        var delivered = SeedApplication(job);
        var undelivered = SeedApplication(job);
        await DeliverOneAsync(job, delivered);

        var (items, total) = await new ApplicationRepository(_context).GetRecruitmentApplicationsAsync(
            _companyId, job.JobId, null, null, null, null, 1, 20);

        items.Select(a => a.ApplicationId).Should().Equal(delivered.ApplicationId);
        total.Should().Be(1);
        undelivered.Status.Should().Be(ApplicationStates.Shortlisted);
    }
}
