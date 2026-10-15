using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Finance.ReplacementSlots;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Finance.Commands.WarrantyClaims;

/// <param name="Replacement">Set when a confirmed resignation opened a replacement slot; null otherwise.</param>
public sealed record WarrantyClaimResponse(
    Guid PlacementId, string WarrantyStatus, string PlacementStatus, IReadOnlyList<CommissionStatusDto> Commissions,
    ReplacementSummaryDto? Replacement = null);

public sealed record CommissionStatusDto(Guid CommissionId, string Status);

/// <summary>Client reports that the placed candidate left before the warranty ended.</summary>
public sealed record ReportResignationCommand(
    Guid PlacementId, DateOnly LastWorkingDate, string Reason, Guid CurrentUserId) : IRequest<WarrantyClaimResponse>;

/// <summary>Internal HR verifies a reported resignation: confirm voids the warranty, reject restores it.</summary>
public sealed record ResolveResignationCommand(
    Guid PlacementId, bool Confirmed, string? Note, Guid CurrentUserId) : IRequest<WarrantyClaimResponse>;

public sealed class ReportResignationCommandHandler : IRequestHandler<ReportResignationCommand, WarrantyClaimResponse>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public ReportResignationCommandHandler(
        IFinanceRepository financeRepository, ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork, IAuditLogService auditLogService)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<WarrantyClaimResponse> Handle(ReportResignationCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length > 2000)
        {
            throw new BadRequestException("Lý do nghỉ việc là bắt buộc và tối đa 2000 ký tự.");
        }

        var placement = await _financeRepository.GetPlacementForFinanceAsync(request.PlacementId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy thông tin nhận việc (Placement).");
        var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
        if (companyUser == null || placement.Application.Job.CompanyId != companyUser.CompanyId)
        {
            // Same answer as a missing placement: do not reveal other companies' placements.
            throw new NotFoundException("Không tìm thấy thông tin nhận việc (Placement).");
        }

        var warranty = placement.Warranty
            ?? throw new BadRequestException("Placement này không có bảo hành (chỉ áp dụng cho HEADHUNT_COD).");
        if (warranty.Status != WarrantyStates.Active)
        {
            throw new ConflictException($"Chỉ báo nghỉ khi bảo hành đang ACTIVE. Trạng thái hiện tại: {warranty.Status}.");
        }

        if (request.LastWorkingDate < warranty.StartDate || (warranty.EndDate is DateOnly end && request.LastWorkingDate >= end))
        {
            throw new BadRequestException(
                $"Ngày làm việc cuối phải nằm trong thời hạn bảo hành ({warranty.StartDate:yyyy-MM-dd} đến trước {warranty.EndDate:yyyy-MM-dd}).");
        }

        var now = DateTime.UtcNow;
        warranty.Status = WarrantyStates.Claimed;
        warranty.ResultNote = $"Client báo nghỉ, ngày làm việc cuối {request.LastWorkingDate:yyyy-MM-dd}: {request.Reason.Trim()}";
        warranty.UpdatedBy = request.CurrentUserId;
        warranty.UpdatedAt = now;
        // Hold the commission while Internal HR verifies the resignation (PENDING kept for rows created before IN_WARRANTY).
        foreach (var commission in placement.Commissions.Where(c => c.Status is CommissionStates.InWarranty or CommissionStates.Pending))
        {
            commission.Status = CommissionStates.OnHold;
            commission.UpdatedAt = now;
        }

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.WarrantyClaimReported,
            EntityType = "WARRANTY",
            EntityId = warranty.WarrantyId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = WarrantyStates.Active },
            NewValues = new { status = warranty.Status, lastWorkingDate = request.LastWorkingDate, reason = request.Reason.Trim() },
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return WarrantyClaimMapping.ToResponse(placement);
    }
}

public sealed class ResolveResignationCommandHandler : IRequestHandler<ResolveResignationCommand, WarrantyClaimResponse>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly IAdminBusinessSettings _settings;
    private readonly INotificationRepository? _notificationRepository;

    public ResolveResignationCommandHandler(
        IFinanceRepository financeRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService,
        IAdminBusinessSettings settings, INotificationRepository? notificationRepository = null)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _settings = settings;
        _notificationRepository = notificationRepository;
    }

    public async Task<WarrantyClaimResponse> Handle(ResolveResignationCommand request, CancellationToken cancellationToken)
    {
        if (!request.Confirmed && string.IsNullOrWhiteSpace(request.Note))
        {
            throw new BadRequestException("Bác bỏ báo nghỉ cần ghi chú lý do.");
        }

        var placement = await _financeRepository.GetPlacementForFinanceAsync(request.PlacementId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy thông tin nhận việc (Placement).");
        var warranty = placement.Warranty
            ?? throw new BadRequestException("Placement này không có bảo hành.");
        if (warranty.Status != WarrantyStates.Claimed)
        {
            throw new ConflictException($"Không có báo nghỉ nào đang chờ xác minh. Trạng thái bảo hành: {warranty.Status}.");
        }

        var now = DateTime.UtcNow;
        var note = request.Note?.Trim();
        var held = placement.Commissions.Where(c => c.Status == CommissionStates.OnHold).ToList();
        ReplacementSlot? replacement = null;
        if (request.Confirmed)
        {
            warranty.Status = WarrantyStates.Voided;
            placement.Status = PlacementStates.LeftDuringWarranty;
            placement.UpdatedAt = now;
            foreach (var commission in held)
            {
                commission.Status = CommissionStates.Cancelled;
                commission.UpdatedAt = now;
            }

            // The fee is kept (no refund); the Client gets one free replacement instead.
            replacement = await OpenReplacementSlotAsync(placement, request.CurrentUserId, now, cancellationToken);
        }
        else
        {
            // The worker passes the warranty on its next run if the end date is already behind us.
            warranty.Status = WarrantyStates.Active;
            foreach (var commission in held)
            {
                // Claim rejected: back inside the warranty window, so the worker can earn it when the window ends.
                commission.Status = CommissionStates.InWarranty;
                commission.UpdatedAt = now;
            }
        }

        warranty.ResultNote = $"{warranty.ResultNote} | Internal HR {(request.Confirmed ? "xác nhận" : "bác bỏ")}: {note}".Trim();
        warranty.UpdatedBy = request.CurrentUserId;
        warranty.UpdatedAt = now;

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.WarrantyClaimResolved,
            EntityType = "WARRANTY",
            EntityId = warranty.WarrantyId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = WarrantyStates.Claimed },
            NewValues = new { status = warranty.Status, confirmed = request.Confirmed, note, commissions = held.Select(c => new { c.CommissionId, c.Status }) },
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return WarrantyClaimMapping.ToResponse(placement) with
        {
            Replacement = replacement == null ? null : ReplacementSlotMapping.ToSummary(replacement),
        };
    }

    /// <summary>
    /// S1 of docs/MF05/mf05-thiet-ke-suat-thay-the.md: one slot per fee, OPEN when the fee is paid,
    /// otherwise WAITING_PAYMENT until it is. Returns null (and audits why) when no slot is allowed.
    /// </summary>
    private async Task<ReplacementSlot?> OpenReplacementSlotAsync(Placement placement, Guid actorUserId, DateTime now, CancellationToken cancellationToken)
    {
        var fee = placement.ServiceFee;
        var refusal = placement.ReplacementSlotId != null
            ? "Ứng viên đã nghỉ là người thay thế; mỗi khoản phí chỉ được thay thế miễn phí 1 lần nên bảo hành coi như đã hoàn thành."
            : fee == null ? "Placement không có phí dịch vụ nên không có suất thay thế."
            : fee.Status == ServiceFeeStates.Cancelled ? "Phí dịch vụ đã bị hủy nên không có suất thay thế."
            : null;
        if (refusal == null && await _financeRepository.GetReplacementSlotByServiceFeeForUpdateAsync(fee!.ServiceFeeId, cancellationToken) != null)
        {
            refusal = "Khoản phí này đã được dùng cho một suất thay thế.";
        }

        if (refusal != null)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.ReplacementNotAllowed,
                EntityType = "PLACEMENT",
                EntityId = placement.PlacementId,
                ActorUserId = actorUserId,
                NewValues = new { code = ReplacementSlotErrorCodes.NotAllowed, reason = refusal },
            }, cancellationToken);
            return null;
        }

        var slot = new ReplacementSlot
        {
            ReplacementSlotId = Guid.NewGuid(),
            JobId = placement.Application.JobId,
            OriginalPlacementId = placement.PlacementId,
            ServiceFeeId = fee!.ServiceFeeId,
            Status = ReplacementSlotStates.WaitingPayment,
            FillWindowDays = await _settings.GetIntAsync(BusinessSettingKeys.ReplacementFillWindowDays, cancellationToken),
            CreatedBy = actorUserId,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _financeRepository.AddReplacementSlotAsync(slot, cancellationToken);
        if (fee.Status == ServiceFeeStates.Paid)
        {
            await ReplacementSlotLifecycle.OpenAsync(
                slot, placement.Application.Job, now, actorUserId, _financeRepository, _notificationRepository, cancellationToken);
        }

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ReplacementSlotOpened,
            EntityType = "REPLACEMENT_SLOT",
            EntityId = slot.ReplacementSlotId,
            ActorUserId = actorUserId,
            NewValues = new { slot.Status, slot.JobId, slot.OriginalPlacementId, slot.ServiceFeeId, slot.FillWindowDays, slot.ExpiresAt },
        }, cancellationToken);
        return slot;
    }
}

internal static class WarrantyClaimMapping
{
    public static WarrantyClaimResponse ToResponse(Domain.Entities.Placement placement) => new(
        placement.PlacementId,
        placement.Warranty!.Status,
        placement.Status,
        placement.Commissions.Select(c => new CommissionStatusDto(c.CommissionId, c.Status)).ToList());
}
