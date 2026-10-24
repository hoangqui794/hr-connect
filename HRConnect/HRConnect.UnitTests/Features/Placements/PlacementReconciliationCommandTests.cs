using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Placements.Commands.ReconcilePlacement;
using HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Placements;

public sealed class PlacementReconciliationCommandTests
{
    private readonly Mock<IPlacementReconciliationRepository> _repository = new();
    private readonly Mock<INotificationRepository> _notifications = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IWarrantyProgressService> _warrantyProgress = new();
    private readonly Mock<IAdminBusinessSettings> _settings = new();

    private ReconcilePlacementCommandHandler ReconcileHandler() => new(
        _repository.Object, _notifications.Object, _audit.Object, _unitOfWork.Object,
        _warrantyProgress.Object, _settings.Object);

    private ResolveFlaggedReconciliationCommandHandler ResolveHandler() => new(
        _repository.Object, _audit.Object, _unitOfWork.Object,
        _warrantyProgress.Object, _settings.Object);

    [Fact]
    public async Task Confirm_pending_record_marks_it_confirmed_and_commits_once()
    {
        var item = Pending();
        _repository.Setup(r => r.GetByApplicationIdAsync(item.ApplicationId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        var result = await ReconcileHandler().Handle(new ReconcilePlacementCommand(
            item.ApplicationId, "CONFIRM", "CANDIDATE", null, item.ConcurrencyToken, Guid.NewGuid()), default);

        result.Status.Should().Be(PlacementReconciliationStates.Confirmed);
        item.ContactChannel.Should().Be(PlacementReconciliationContactChannels.Candidate);
        item.ReviewedAt.Should().NotBeNull();
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _audit.Verify(a => a.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.PlacementReconciled),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Flag_without_note_is_rejected_without_commit()
    {
        var item = Pending();
        _repository.Setup(r => r.GetByApplicationIdAsync(item.ApplicationId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        var act = () => ReconcileHandler().Handle(new ReconcilePlacementCommand(
            item.ApplicationId, "FLAG", "BOTH", " ", item.ConcurrencyToken, Guid.NewGuid()), default);

        var error = await act.Should().ThrowAsync<BadRequestException>();
        error.Which.ErrorCode.Should().Be(PlacementReconciliationErrorCodes.NoteRequired);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Flag_not_started_notifies_admin_and_attributed_affiliate()
    {
        var item = Pending(PlacementReconciliationOutcomes.NotStarted);
        var adminId = Guid.NewGuid();
        var affiliateId = Guid.NewGuid();
        _repository.Setup(r => r.GetByApplicationIdAsync(item.ApplicationId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);
        _repository.Setup(r => r.GetActivePlatformAdminUserIdsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { adminId });
        _repository.Setup(r => r.GetAttributedAffiliateUserIdAsync(item.ApplicationId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(affiliateId);

        await ReconcileHandler().Handle(new ReconcilePlacementCommand(
            item.ApplicationId, "FLAG", "BOTH", "Ứng viên xác nhận đã đi làm.", item.ConcurrencyToken, Guid.NewGuid()), default);

        item.Status.Should().Be(PlacementReconciliationStates.Flagged);
        _notifications.Verify(n => n.AddAsync(
            It.Is<Notification>(x => x.UserId == adminId && x.RelatedEntityId == item.ReconciliationId),
            It.IsAny<CancellationToken>()), Times.Once);
        _notifications.Verify(n => n.AddAsync(
            It.Is<Notification>(x => x.UserId == affiliateId && x.RelatedEntityId == item.ReconciliationId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Reprocessing_a_confirmed_record_returns_stable_conflict()
    {
        var item = Pending();
        item.Status = PlacementReconciliationStates.Confirmed;
        _repository.Setup(r => r.GetByApplicationIdAsync(item.ApplicationId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        var act = () => ReconcileHandler().Handle(new ReconcilePlacementCommand(
            item.ApplicationId, "CONFIRM", "CANDIDATE", null, item.ConcurrencyToken, Guid.NewGuid()), default);

        var error = await act.Should().ThrowAsync<ConflictException>();
        error.Which.ErrorCode.Should().Be(PlacementReconciliationErrorCodes.NotPending);
    }

    [Fact]
    public async Task Reconcile_with_stale_token_is_rejected_without_changes()
    {
        var item = Pending();
        _repository.Setup(r => r.GetByApplicationIdAsync(item.ApplicationId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        var act = () => ReconcileHandler().Handle(new ReconcilePlacementCommand(
            item.ApplicationId, "CONFIRM", "CANDIDATE", null, Guid.NewGuid(), Guid.NewGuid()), default);

        await act.Should().ThrowAsync<ConflictException>();
        item.Status.Should().Be(PlacementReconciliationStates.Pending);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Admin_resolution_preserves_flag_note_and_stores_resolution_separately()
    {
        var item = Pending();
        item.Status = PlacementReconciliationStates.Flagged;
        item.Note = "Ứng viên nói đã đi làm nhưng Client khai ngược lại.";
        item.ReviewedAt = DateTime.UtcNow.AddHours(-1);
        _repository.Setup(r => r.GetByApplicationIdAsync(item.ApplicationId, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        await ResolveHandler().Handle(new ResolveFlaggedReconciliationCommand(
            item.ApplicationId, "Đã đối chiếu biên bản nhận việc.", item.ConcurrencyToken, Guid.NewGuid()), default);

        item.Status.Should().Be(PlacementReconciliationStates.Confirmed);
        item.Note.Should().Contain("Ứng viên nói đã đi làm");
        item.ResolutionNote.Should().Be("Đã đối chiếu biên bản nhận việc.");
        _audit.Verify(a => a.AddAsync(
            It.Is<AuditEntry>(entry => entry.Action == AuditActions.PlacementReconciliationResolved),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    private static PlacementReconciliation Pending(string outcome = PlacementReconciliationOutcomes.Started)
    {
        var company = new Company { CompanyId = Guid.NewGuid(), CompanyName = "ABC" };
        var job = new Job { JobId = Guid.NewGuid(), Company = company, Title = "Backend Developer" };
        var candidate = new Candidate { CandidateId = Guid.NewGuid(), FullName = "Nguyễn Văn An" };
        var application = new HRConnect.Domain.Entities.Application
        {
            ApplicationId = Guid.NewGuid(), Job = job, Candidate = candidate,
        };
        return new PlacementReconciliation
        {
            ReconciliationId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            Application = application,
            ClaimedOutcome = outcome,
            Status = PlacementReconciliationStates.Pending,
            ConcurrencyToken = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
    }
}
