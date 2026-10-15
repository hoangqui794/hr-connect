using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Finance.ReplacementSlots;

/// <summary>Short slot summary returned when a resignation is confirmed (S1).</summary>
public sealed record ReplacementSummaryDto(Guid ReplacementSlotId, Guid JobId, string Status, DateTime? ExpiresAt);

public sealed record ReplacementSlotDto(
    Guid ReplacementSlotId,
    Guid JobId,
    string Status,
    Guid OriginalPlacementId,
    string? OriginalCandidateName,
    Guid ServiceFeeId,
    int FillWindowDays,
    DateTime? OpenedAt,
    DateTime? ExpiresAt,
    Guid? FilledByPlacementId,
    string? ReplacementCandidateName,
    DateTime? ClosedAt,
    string? CancelReason,
    Guid ConcurrencyToken,
    DateTime CreatedAt);

/// <summary>
/// Slots of one job. <paramref name="ClientUserId"/> is set for a Client caller, who may only
/// see jobs of their own company.
/// </summary>
public sealed record GetJobReplacementSlotsQuery(Guid JobId, Guid? ClientUserId) : IRequest<IReadOnlyList<ReplacementSlotDto>>;

/// <summary>Internal HR cancels a WAITING_PAYMENT or OPEN slot (S4), e.g. the Client no longer needs a replacement. No refund.</summary>
public sealed record CancelReplacementSlotCommand(
    Guid ReplacementSlotId, string Reason, Guid ConcurrencyToken, Guid CurrentUserId) : IRequest<ReplacementSlotDto>;

public sealed class GetJobReplacementSlotsQueryHandler : IRequestHandler<GetJobReplacementSlotsQuery, IReadOnlyList<ReplacementSlotDto>>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;

    public GetJobReplacementSlotsQueryHandler(IFinanceRepository financeRepository, ICompanyUserRepository companyUserRepository)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
    }

    public async Task<IReadOnlyList<ReplacementSlotDto>> Handle(GetJobReplacementSlotsQuery request, CancellationToken cancellationToken)
    {
        var companyId = await _financeRepository.GetJobCompanyIdAsync(request.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy job.");
        if (request.ClientUserId is Guid clientUserId)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(clientUserId, cancellationToken);
            if (companyUser == null || companyUser.CompanyId != companyId)
            {
                // Same answer as a missing job: do not reveal other companies' jobs.
                throw new NotFoundException("Không tìm thấy job.");
            }
        }

        var slots = await _financeRepository.GetReplacementSlotsByJobAsync(request.JobId, cancellationToken);
        return slots.Select(ReplacementSlotMapping.ToDto).ToList();
    }
}

public sealed class CancelReplacementSlotCommandHandler : IRequestHandler<CancelReplacementSlotCommand, ReplacementSlotDto>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public CancelReplacementSlotCommandHandler(IFinanceRepository financeRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<ReplacementSlotDto> Handle(CancelReplacementSlotCommand request, CancellationToken cancellationToken)
    {
        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason) || reason.Length > 500)
        {
            throw new BadRequestException("Lý do hủy suất thay thế là bắt buộc và tối đa 500 ký tự.");
        }

        var slot = await _financeRepository.GetReplacementSlotForUpdateAsync(request.ReplacementSlotId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy suất thay thế.");
        if (slot.ConcurrencyToken != request.ConcurrencyToken)
        {
            throw new ConflictException("Suất thay thế vừa được cập nhật bởi người khác. Tải lại rồi thử lại.",
                ReplacementSlotErrorCodes.ConcurrencyConflict);
        }

        if (slot.Status is not (ReplacementSlotStates.WaitingPayment or ReplacementSlotStates.Open))
        {
            throw new ConflictException($"Chỉ hủy được suất WAITING_PAYMENT hoặc OPEN. Trạng thái hiện tại: {slot.Status}.",
                ReplacementSlotErrorCodes.NotCancellable);
        }

        var now = DateTime.UtcNow;
        var oldStatus = slot.Status;
        slot.Status = ReplacementSlotStates.Cancelled;
        slot.CancelReason = reason;
        slot.ClosedAt = now;
        slot.ClosedBy = request.CurrentUserId;
        slot.ConcurrencyToken = Guid.NewGuid();
        slot.UpdatedAt = now;

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ReplacementSlotCancelled,
            EntityType = "REPLACEMENT_SLOT",
            EntityId = slot.ReplacementSlotId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = slot.Status, reason },
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ReplacementSlotMapping.ToDto(slot);
    }
}

internal static class ReplacementSlotMapping
{
    public static ReplacementSlotDto ToDto(ReplacementSlot slot) => new(
        slot.ReplacementSlotId,
        slot.JobId,
        slot.Status,
        slot.OriginalPlacementId,
        slot.OriginalPlacement?.Application?.Candidate?.FullName,
        slot.ServiceFeeId,
        slot.FillWindowDays,
        slot.OpenedAt,
        slot.ExpiresAt,
        slot.FilledByPlacementId,
        slot.FilledByPlacement?.Application?.Candidate?.FullName,
        slot.ClosedAt,
        slot.CancelReason,
        slot.ConcurrencyToken,
        slot.CreatedAt);

    public static ReplacementSummaryDto ToSummary(ReplacementSlot slot) =>
        new(slot.ReplacementSlotId, slot.JobId, slot.Status, slot.ExpiresAt);
}
