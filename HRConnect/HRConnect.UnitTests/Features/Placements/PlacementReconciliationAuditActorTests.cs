using System.Net;
using FluentAssertions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Placements.Commands.ReconcilePlacement;
using HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using HRConnect.Infrastructure.Persistence;
using HRConnect.Infrastructure.Repositories;
using HRConnect.Infrastructure.Services.Audit;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;
using JobApplication = HRConnect.Domain.Entities.Application;

namespace HRConnect.UnitTests.Features.Placements;

/// <summary>
/// Confirming a reconciliation advances the service fee inside the user's HTTP request, while the background worker
/// advances it without one. Runs the real AuditLogService, which rejects a SERVICE actor that carries a user id.
/// </summary>
public sealed class PlacementReconciliationAuditActorTests : IDisposable
{
    private const int ReminderDays = 5;

    private readonly ApplicationDbContext _context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private readonly Mock<IRequestContext> _requestContext = new();
    private readonly Mock<IAdminBusinessSettings> _settings = new();
    private readonly Guid _actor = Guid.NewGuid();

    public PlacementReconciliationAuditActorTests()
    {
        _settings.Setup(s => s.GetIntAsync(BusinessSettingKeys.FeeDueReminderDays, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ReminderDays);
    }

    public void Dispose() => _context.Dispose();

    [Theory]
    [InlineData(-1, ServiceFeeStates.Overdue, AuditActions.ServiceFeeOverdue)]
    [InlineData(2, ServiceFeeStates.Due, AuditActions.ServiceFeeDue)]
    public async Task Reconcile_confirm_advances_fee_and_audits_the_user(int dueInDays, string feeStatus, string action)
    {
        UseUserRequest();
        var item = await SeedAsync(PlacementReconciliationStates.Pending, dueInDays);
        var handler = new ReconcilePlacementCommandHandler(
            new PlacementReconciliationRepository(_context), new NotificationRepository(_context), Audit(),
            new UnitOfWork(_context), Progress(), _settings.Object);

        await handler.Handle(new ReconcilePlacementCommand(
            item.ApplicationId, PlacementReconciliationDecisions.Confirm,
            PlacementReconciliationContactChannels.Candidate, null, item.ConcurrencyToken, _actor), default);

        await AssertUserAuditAsync(feeStatus, action);
    }

    [Theory]
    [InlineData(-1, ServiceFeeStates.Overdue, AuditActions.ServiceFeeOverdue)]
    [InlineData(2, ServiceFeeStates.Due, AuditActions.ServiceFeeDue)]
    public async Task Resolve_flagged_advances_fee_and_audits_the_user(int dueInDays, string feeStatus, string action)
    {
        UseUserRequest();
        var item = await SeedAsync(PlacementReconciliationStates.Flagged, dueInDays);
        var application = await _context.Applications.SingleAsync();
        var applications = new Mock<HRConnect.Application.Common.Interfaces.Repositories.IApplicationRepository>();
        applications.Setup(r => r.GetByIdAsync(item.ApplicationId, It.IsAny<CancellationToken>())).ReturnsAsync(application);
        var handler = new ResolveFlaggedReconciliationCommandHandler(
            new PlacementReconciliationRepository(_context), applications.Object, Audit(),
            new UnitOfWork(_context), Progress(), _settings.Object);

        await handler.Handle(new ResolveFlaggedReconciliationCommand(
            item.ApplicationId, PlacementReconciliationResolutionActions.ConfirmReportedOutcome,
            "Đã đối chiếu biên bản nhận việc.", item.ConcurrencyToken, _actor), default);

        await AssertUserAuditAsync(feeStatus, action);
    }

    [Theory]
    [InlineData(-1, ServiceFeeStates.Overdue, AuditActions.ServiceFeeOverdue)]
    [InlineData(2, ServiceFeeStates.Due, AuditActions.ServiceFeeDue)]
    public async Task Worker_without_a_request_still_audits_as_service(int dueInDays, string feeStatus, string action)
    {
        await SeedAsync(PlacementReconciliationStates.Confirmed, dueInDays);
        var feeId = (await _context.ServiceFees.SingleAsync()).ServiceFeeId;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var changed = feeStatus == ServiceFeeStates.Overdue
            ? await Progress().MarkServiceFeeOverdueAsync(feeId, today)
            : await Progress().MarkServiceFeeDueAsync(feeId, today, ReminderDays);

        changed.Should().BeTrue();
        (await _context.ServiceFees.AsNoTracking().SingleAsync()).Status.Should().Be(feeStatus);
        var log = await _context.AuditLogs.AsNoTracking().SingleAsync(a => a.Action == action);
        log.ActorType.Should().Be(AuditActorTypes.Service);
        log.ActorUserId.Should().BeNull();
        log.Source.Should().Be(AuditSources.BackgroundWorker);
        log.ServiceName.Should().Be("WarrantyProgressWorker");
    }

    private AuditLogService Audit() => new(_context, _requestContext.Object);

    private WarrantyProgressService Progress() => new(
        new FinanceRepository(_context), new UnitOfWork(_context), Audit(), new NotificationRepository(_context),
        new PlacementReconciliationRepository(_context), _settings.Object, Mock.Of<IAppNotifier>());

    private void UseUserRequest()
    {
        _requestContext.SetupGet(c => c.UserId).Returns(_actor);
        _requestContext.SetupGet(c => c.CorrelationId).Returns(Guid.NewGuid());
        _requestContext.SetupGet(c => c.IpAddress).Returns(IPAddress.Loopback);
    }

    private async Task AssertUserAuditAsync(string feeStatus, string action)
    {
        (await _context.ServiceFees.AsNoTracking().SingleAsync()).Status.Should().Be(feeStatus);
        var log = await _context.AuditLogs.AsNoTracking().SingleAsync(a => a.Action == action);
        log.ActorType.Should().Be(AuditActorTypes.User);
        log.ActorUserId.Should().Be(_actor);
        log.Source.Should().Be(AuditSources.Api);
        log.ServiceName.Should().BeNull();
    }

    private async Task<PlacementReconciliation> SeedAsync(string status, int dueInDays)
    {
        var now = DateTime.UtcNow;
        var company = new Company
        {
            CompanyId = Guid.NewGuid(), CompanyName = "ABC", VerificationStatus = "VERIFIED", CreatedAt = now, UpdatedAt = now,
        };
        var job = new Job
        {
            JobId = Guid.NewGuid(), CompanyId = company.CompanyId, ServiceTypeId = Guid.NewGuid(), CreatedBy = Guid.NewGuid(),
            Title = "Backend Developer", CurrencyCode = "VND", Quantity = 1, Status = "ACTIVE",
            CreatedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        var candidate = new Candidate
        {
            CandidateId = Guid.NewGuid(), FullName = "Nguyễn Văn An", ProfileVisibility = "PRIVATE", Status = "ACTIVE",
            CreatedAt = now, UpdatedAt = now,
        };
        var application = new JobApplication
        {
            ApplicationId = Guid.NewGuid(), JobId = job.JobId, CandidateId = candidate.CandidateId,
            Status = ApplicationStates.Placed, AppliedAt = now, UpdatedAt = now, ConcurrencyToken = Guid.NewGuid(),
        };
        var placement = new Placement
        {
            PlacementId = Guid.NewGuid(), ApplicationId = application.ApplicationId, OfferId = Guid.NewGuid(),
            ActualStartDate = DateOnly.FromDateTime(now), Status = PlacementStates.Started,
            ConfirmedAt = now, CreatedAt = now, UpdatedAt = now,
        };
        var fee = new ServiceFee
        {
            ServiceFeeId = Guid.NewGuid(), PlacementId = placement.PlacementId, JobId = job.JobId,
            Kind = ServiceFeeKinds.Placement, CompanyId = company.CompanyId, BaseSalary = 20_000_000m, FeeMultiplier = 1m,
            Amount = 20_000_000m, CurrencyCode = "VND", DueDate = DateOnly.FromDateTime(now).AddDays(dueInDays),
            Status = ServiceFeeStates.Pending, CreatedAt = now, UpdatedAt = now,
        };
        var item = new PlacementReconciliation
        {
            ReconciliationId = Guid.NewGuid(), ApplicationId = application.ApplicationId, PlacementId = placement.PlacementId,
            ClaimedOutcome = PlacementReconciliationOutcomes.Started, Status = status,
            ConcurrencyToken = Guid.NewGuid(), CreatedAt = now, UpdatedAt = now,
        };
        _context.AddRange(company, job, candidate, application, placement, fee, item);
        await _context.SaveChangesAsync();
        return item;
    }
}
