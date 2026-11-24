using FluentAssertions;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.ReplacementSlots;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using Moq;
using Xunit;

namespace HRConnect.UnitTests.Features.Finance;

public class RequestCancelReplacementSlotTests
{
    private readonly Mock<IFinanceRepository> _financeRepo = new();
    private readonly Mock<ICompanyUserRepository> _companyUserRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditLogService> _audit = new();
    private readonly Mock<IAppNotifier> _notifier = new();

    private readonly Guid _companyId = Guid.NewGuid();
    private readonly Guid _clientUserId = Guid.NewGuid();

    private RequestCancelReplacementSlotCommandHandler CreateHandler() => new(
        _financeRepo.Object,
        _companyUserRepo.Object,
        _unitOfWork.Object,
        _audit.Object,
        _notifier.Object);

    private void SetupActiveCompanyMember(Guid? companyId = null)
    {
        _companyUserRepo
            .Setup(r => r.GetByUserIdAsync(_clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CompanyUser
            {
                CompanyUserId = Guid.NewGuid(),
                CompanyId = companyId ?? _companyId,
                UserId = _clientUserId,
                Status = "ACTIVE",
            });
    }

    private ReplacementSlot BuildSlot(string status, Guid? companyId = null, DateTime? cancelRequestedAt = null)
    {
        var cid = companyId ?? _companyId;
        var jobId = Guid.NewGuid();
        return new ReplacementSlot
        {
            ReplacementSlotId = Guid.NewGuid(),
            JobId = jobId,
            OriginalPlacementId = Guid.NewGuid(),
            ServiceFeeId = Guid.NewGuid(),
            Status = status,
            FillWindowDays = 30,
            ConcurrencyToken = Guid.NewGuid(),
            CancelRequestedAt = cancelRequestedAt,
            CreatedAt = DateTime.UtcNow.AddDays(-2),
            UpdatedAt = DateTime.UtcNow.AddDays(-1),
            Job = new Job
            {
                JobId = jobId,
                CompanyId = cid,
                Title = "Senior .NET Developer",
                Company = new Company
                {
                    CompanyId = cid,
                    CompanyName = "FinTech Việt",
                },
            },
        };
    }

    [Theory]
    [InlineData(ReplacementSlotStates.Open)]
    [InlineData(ReplacementSlotStates.WaitingPayment)]
    public async Task Handle_WhenOpenOrWaitingPayment_RecordsCancelRequestWithoutCancellingAndNotifiesHr(string initialStatus)
    {
        SetupActiveCompanyMember();
        var slot = BuildSlot(initialStatus);
        var originalToken = slot.ConcurrencyToken;

        _financeRepo
            .Setup(r => r.GetReplacementSlotForUpdateAsync(slot.ReplacementSlotId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(slot);

        var handler = CreateHandler();
        var result = await handler.Handle(
            new RequestCancelReplacementSlotCommand(slot.ReplacementSlotId, "  Công ty đã tuyển nội bộ  ", originalToken, _clientUserId),
            CancellationToken.None);

        result.Status.Should().Be(initialStatus);
        result.CancelRequestedAt.Should().NotBeNull();
        result.CancelRequestReason.Should().Be("Công ty đã tuyển nội bộ");
        result.ConcurrencyToken.Should().NotBe(originalToken);

        slot.Status.Should().Be(initialStatus);
        slot.CancelRequestedBy.Should().Be(_clientUserId);
        slot.CancelRequestReason.Should().Be("Công ty đã tuyển nội bộ");
        slot.ClosedAt.Should().BeNull();
        slot.CancelReason.Should().BeNull();

        _audit.Verify(
            a => a.AddAsync(
                It.Is<AuditEntry>(e =>
                    e.Action == AuditActions.ReplacementSlotCancelRequested &&
                    e.EntityType == "REPLACEMENT_SLOT" &&
                    e.EntityId == slot.ReplacementSlotId &&
                    e.ActorUserId == _clientUserId),
                It.IsAny<CancellationToken>()),
            Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _notifier.Verify(
            n => n.NotifyRoleAsync(
                "INTERNAL_HR",
                It.Is<AppNotice>(notice =>
                    notice.NotificationType == "WARRANTY" &&
                    notice.RelatedEntityType == "REPLACEMENT_SLOT" &&
                    notice.RelatedEntityId == slot.ReplacementSlotId &&
                    notice.RouteHint == "/hr/warranty-tracking" &&
                    notice.Message.Contains("FinTech Việt") &&
                    notice.Message.Contains("Senior .NET Developer") &&
                    notice.Message.Contains("Công ty đã tuyển nội bộ")),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_WhenNotActiveCompanyMember_ThrowsForbidden()
    {
        _companyUserRepo
            .Setup(r => r.GetByUserIdAsync(_clientUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((CompanyUser?)null);

        var handler = CreateHandler();
        var act = () => handler.Handle(
            new RequestCancelReplacementSlotCommand(Guid.NewGuid(), "Không còn nhu cầu", Guid.NewGuid(), _clientUserId),
            CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Handle_WhenSlotBelongsToAnotherCompany_ThrowsNotFound()
    {
        SetupActiveCompanyMember();
        var otherCompanySlot = BuildSlot(ReplacementSlotStates.Open, companyId: Guid.NewGuid());
        _financeRepo
            .Setup(r => r.GetReplacementSlotForUpdateAsync(otherCompanySlot.ReplacementSlotId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(otherCompanySlot);

        var handler = CreateHandler();
        var act = () => handler.Handle(
            new RequestCancelReplacementSlotCommand(otherCompanySlot.ReplacementSlotId, "Lý do hợp lệ", otherCompanySlot.ConcurrencyToken, _clientUserId),
            CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Theory]
    [InlineData(ReplacementSlotStates.Filled)]
    [InlineData(ReplacementSlotStates.Cancelled)]
    [InlineData(ReplacementSlotStates.Expired)]
    public async Task Handle_WhenStatusNotCancellable_ThrowsConflictWithNotCancellableCode(string status)
    {
        SetupActiveCompanyMember();
        var slot = BuildSlot(status);
        _financeRepo
            .Setup(r => r.GetReplacementSlotForUpdateAsync(slot.ReplacementSlotId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(slot);

        var handler = CreateHandler();
        var act = () => handler.Handle(
            new RequestCancelReplacementSlotCommand(slot.ReplacementSlotId, "Lý do hợp lệ", slot.ConcurrencyToken, _clientUserId),
            CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ConflictException>();
        ex.Which.ErrorCode.Should().Be(ReplacementSlotErrorCodes.NotCancellable);
    }

    [Fact]
    public async Task Handle_WhenCancelAlreadyRequested_ThrowsConflict()
    {
        SetupActiveCompanyMember();
        var slot = BuildSlot(ReplacementSlotStates.Open, cancelRequestedAt: DateTime.UtcNow.AddHours(-1));
        _financeRepo
            .Setup(r => r.GetReplacementSlotForUpdateAsync(slot.ReplacementSlotId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(slot);

        var handler = CreateHandler();
        var act = () => handler.Handle(
            new RequestCancelReplacementSlotCommand(slot.ReplacementSlotId, "Gửi lại lần 2", slot.ConcurrencyToken, _clientUserId),
            CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Handle_WhenReasonMissing_ThrowsBadRequest(string invalidReason)
    {
        SetupActiveCompanyMember();
        var handler = CreateHandler();

        var act = () => handler.Handle(
            new RequestCancelReplacementSlotCommand(Guid.NewGuid(), invalidReason, Guid.NewGuid(), _clientUserId),
            CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Handle_WhenReasonTooLong_ThrowsBadRequest()
    {
        SetupActiveCompanyMember();
        var handler = CreateHandler();

        var act = () => handler.Handle(
            new RequestCancelReplacementSlotCommand(Guid.NewGuid(), new string('a', 501), Guid.NewGuid(), _clientUserId),
            CancellationToken.None);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Handle_WhenConcurrencyTokenMismatch_ThrowsConflictWithConcurrencyCode()
    {
        SetupActiveCompanyMember();
        var slot = BuildSlot(ReplacementSlotStates.Open);
        _financeRepo
            .Setup(r => r.GetReplacementSlotForUpdateAsync(slot.ReplacementSlotId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(slot);

        var handler = CreateHandler();
        var act = () => handler.Handle(
            new RequestCancelReplacementSlotCommand(slot.ReplacementSlotId, "Lý do hợp lệ", Guid.NewGuid(), _clientUserId),
            CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ConflictException>();
        ex.Which.ErrorCode.Should().Be(ReplacementSlotErrorCodes.ConcurrencyConflict);
    }
}
