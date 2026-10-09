using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Finance.Commands.Settlement;

public sealed record ServiceFeePaymentResponse(Guid ServiceFeeId, string Status, DateTime? PaidAt, string? PaymentReference);

public sealed record CommissionActionResponse(Guid CommissionId, string Status, decimal Amount, DateTime? ApprovedAt);

public sealed record PayoutResponse(Guid PayoutId, Guid CommissionId, string PayoutStatus, string CommissionStatus, decimal Amount, int AttemptNo);

/// <summary>Platform Admin records that the Client paid the service fee (transfer happens outside the system).</summary>
public sealed record RecordServiceFeePaymentCommand(
    Guid ServiceFeeId, DateTime PaidAt, string PaymentReference, Guid CurrentUserId) : IRequest<ServiceFeePaymentResponse>;

/// <summary>Platform Admin approves an EARNED commission for payment; requires the service fee to be PAID.</summary>
public sealed record ApproveCommissionCommand(Guid CommissionId, Guid CurrentUserId) : IRequest<CommissionActionResponse>;

public sealed record CancelCommissionCommand(Guid CommissionId, string Reason, Guid CurrentUserId) : IRequest<CommissionActionResponse>;

/// <summary>Changes the amount before payment; the old and new amounts are kept in commission_adjustment.</summary>
public sealed record AdjustCommissionCommand(Guid CommissionId, decimal NewAmount, string Reason, Guid CurrentUserId) : IRequest<CommissionActionResponse>;

/// <summary>Platform Admin records an external payout for a PAYABLE commission.</summary>
public sealed record RecordPayoutCommand(
    Guid CommissionId,
    bool Succeeded,
    DateTime PayoutDate,
    string? Method,
    string? TransactionReference,
    string? EvidenceUrl,
    Guid CurrentUserId) : IRequest<PayoutResponse>;

public sealed class SettlementCommandHandlers :
    IRequestHandler<RecordServiceFeePaymentCommand, ServiceFeePaymentResponse>,
    IRequestHandler<ApproveCommissionCommand, CommissionActionResponse>,
    IRequestHandler<CancelCommissionCommand, CommissionActionResponse>,
    IRequestHandler<AdjustCommissionCommand, CommissionActionResponse>,
    IRequestHandler<RecordPayoutCommand, PayoutResponse>
{
    private static readonly HashSet<string> CancellableStates =
        [CommissionStates.Pending, CommissionStates.Earned, CommissionStates.OnHold, CommissionStates.Payable];

    private static readonly HashSet<string> AdjustableStates =
        [CommissionStates.Pending, CommissionStates.Earned, CommissionStates.OnHold, CommissionStates.Payable];

    private readonly IFinanceRepository _financeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;

    public SettlementCommandHandlers(IFinanceRepository financeRepository, IUnitOfWork unitOfWork, IAuditLogService auditLogService)
    {
        _financeRepository = financeRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
    }

    public async Task<ServiceFeePaymentResponse> Handle(RecordServiceFeePaymentCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PaymentReference) || request.PaymentReference.Trim().Length > 200)
        {
            throw new BadRequestException("Mã tham chiếu thanh toán là bắt buộc và tối đa 200 ký tự.");
        }

        if (request.PaidAt > DateTime.UtcNow.AddMinutes(5))
        {
            throw new BadRequestException("Ngày thanh toán không được ở tương lai.");
        }

        var fee = await _financeRepository.GetServiceFeeForUpdateAsync(request.ServiceFeeId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy công nợ phí dịch vụ.");
        if (fee.Status is not (ServiceFeeStates.Pending or ServiceFeeStates.Overdue))
        {
            throw new ConflictException($"Chỉ ghi nhận thanh toán cho công nợ PENDING hoặc OVERDUE. Trạng thái hiện tại: {fee.Status}.");
        }

        var oldStatus = fee.Status;
        fee.Status = ServiceFeeStates.Paid;
        fee.PaidAt = DateTime.SpecifyKind(request.PaidAt, DateTimeKind.Utc);
        fee.PaymentReference = request.PaymentReference.Trim();
        fee.RecordedBy = request.CurrentUserId;
        fee.UpdatedAt = DateTime.UtcNow;

        await AuditAsync(AuditActions.ServiceFeePaymentRecorded, "SERVICE_FEE", fee.ServiceFeeId, request.CurrentUserId,
            new { status = oldStatus }, new { status = fee.Status, fee.PaidAt, fee.PaymentReference, fee.Amount }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return new ServiceFeePaymentResponse(fee.ServiceFeeId, fee.Status, fee.PaidAt, fee.PaymentReference);
    }

    public async Task<CommissionActionResponse> Handle(ApproveCommissionCommand request, CancellationToken cancellationToken)
    {
        var commission = await LoadCommissionAsync(request.CommissionId, cancellationToken);
        if (commission.Status != CommissionStates.Earned)
        {
            throw new ConflictException(
                $"Chỉ duyệt hoa hồng đã EARNED (ứng viên đi làm đủ thời hạn bảo hành). Trạng thái hiện tại: {commission.Status}.");
        }

        var fee = commission.Placement.ServiceFee;
        if (fee == null || fee.Status != ServiceFeeStates.Paid)
        {
            throw new ConflictException(
                "Client chưa thanh toán phí dịch vụ của placement này; hoa hồng chỉ được duyệt sau khi đã thu phí.",
                "SERVICE_FEE_NOT_PAID");
        }

        var now = DateTime.UtcNow;
        commission.Status = CommissionStates.Payable;
        commission.ApprovedBy = request.CurrentUserId;
        commission.ApprovedAt = now;
        commission.UpdatedAt = now;

        await AuditAsync(AuditActions.CommissionApproved, "COMMISSION", commission.CommissionId, request.CurrentUserId,
            new { status = CommissionStates.Earned }, new { status = commission.Status, commission.Amount, serviceFeeId = fee.ServiceFeeId }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToResponse(commission);
    }

    public async Task<CommissionActionResponse> Handle(CancelCommissionCommand request, CancellationToken cancellationToken)
    {
        RequireReason(request.Reason);
        var commission = await LoadCommissionAsync(request.CommissionId, cancellationToken);
        if (!CancellableStates.Contains(commission.Status))
        {
            throw new ConflictException($"Không thể hủy hoa hồng ở trạng thái {commission.Status}.");
        }

        var oldStatus = commission.Status;
        commission.Status = CommissionStates.Cancelled;
        commission.UpdatedAt = DateTime.UtcNow;

        await AuditAsync(AuditActions.CommissionCancelled, "COMMISSION", commission.CommissionId, request.CurrentUserId,
            new { status = oldStatus }, new { status = commission.Status, reason = request.Reason.Trim() }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToResponse(commission);
    }

    public async Task<CommissionActionResponse> Handle(AdjustCommissionCommand request, CancellationToken cancellationToken)
    {
        RequireReason(request.Reason);
        if (request.NewAmount < 0)
        {
            throw new BadRequestException("Số tiền hoa hồng không được âm.");
        }

        var commission = await LoadCommissionAsync(request.CommissionId, cancellationToken);
        if (!AdjustableStates.Contains(commission.Status))
        {
            throw new ConflictException($"Không thể điều chỉnh hoa hồng ở trạng thái {commission.Status}.");
        }

        if (commission.Amount == request.NewAmount)
        {
            throw new BadRequestException("Số tiền mới trùng với số tiền hiện tại.");
        }

        var now = DateTime.UtcNow;
        var oldAmount = commission.Amount;
        await _financeRepository.AddCommissionAdjustmentAsync(new CommissionAdjustment
        {
            CommissionAdjustmentId = Guid.NewGuid(),
            CommissionId = commission.CommissionId,
            OldAmount = oldAmount,
            NewAmount = request.NewAmount,
            Reason = request.Reason.Trim(),
            AdjustedBy = request.CurrentUserId,
            AdjustedAt = now,
        }, cancellationToken);
        commission.Amount = request.NewAmount;
        commission.UpdatedAt = now;

        await AuditAsync(AuditActions.CommissionAdjusted, "COMMISSION", commission.CommissionId, request.CurrentUserId,
            new { amount = oldAmount }, new { amount = request.NewAmount, reason = request.Reason.Trim() }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToResponse(commission);
    }

    public async Task<PayoutResponse> Handle(RecordPayoutCommand request, CancellationToken cancellationToken)
    {
        var commission = await LoadCommissionAsync(request.CommissionId, cancellationToken);
        if (commission.Status != CommissionStates.Payable)
        {
            throw new ConflictException($"Chỉ ghi nhận chi cho hoa hồng đã duyệt (PAYABLE). Trạng thái hiện tại: {commission.Status}.");
        }

        if (request.Succeeded && string.IsNullOrWhiteSpace(request.TransactionReference))
        {
            throw new BadRequestException("Lần chi thành công cần mã giao dịch.");
        }

        if (request.PayoutDate > DateTime.UtcNow.AddMinutes(5))
        {
            throw new BadRequestException("Ngày chi không được ở tương lai.");
        }

        var now = DateTime.UtcNow;
        var payout = new Payout
        {
            PayoutId = Guid.NewGuid(),
            CommissionId = commission.CommissionId,
            Amount = commission.Amount,
            PayoutDate = DateTime.SpecifyKind(request.PayoutDate, DateTimeKind.Utc),
            Method = Trim(request.Method, 50),
            TransactionReference = Trim(request.TransactionReference, 200),
            EvidenceUrl = Trim(request.EvidenceUrl, 1000),
            Status = request.Succeeded ? PayoutStates.Completed : PayoutStates.Failed,
            RecordedBy = request.CurrentUserId,
            AttemptNo = commission.Payouts.Count + 1,
            CreatedAt = now,
            UpdatedAt = now,
        };
        await _financeRepository.AddPayoutAsync(payout, cancellationToken);
        if (request.Succeeded)
        {
            commission.Status = CommissionStates.Paid;
            commission.UpdatedAt = now;
        }

        await AuditAsync(AuditActions.PayoutRecorded, "PAYOUT", payout.PayoutId, request.CurrentUserId,
            new { commissionStatus = CommissionStates.Payable },
            new { payout.Status, payout.Amount, payout.AttemptNo, payout.TransactionReference, commissionStatus = commission.Status },
            cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return new PayoutResponse(payout.PayoutId, commission.CommissionId, payout.Status, commission.Status, payout.Amount, payout.AttemptNo);
    }

    private async Task<Commission> LoadCommissionAsync(Guid commissionId, CancellationToken cancellationToken) =>
        await _financeRepository.GetCommissionForUpdateAsync(commissionId, cancellationToken)
        ?? throw new NotFoundException("Không tìm thấy hoa hồng.");

    private static void RequireReason(string? reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 1000)
        {
            throw new BadRequestException("Lý do là bắt buộc và tối đa 1000 ký tự.");
        }
    }

    private static string? Trim(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, max)];

    private static CommissionActionResponse ToResponse(Commission commission) =>
        new(commission.CommissionId, commission.Status, commission.Amount, commission.ApprovedAt);

    private Task AuditAsync(string action, string entityType, Guid entityId, Guid actor, object oldValues, object newValues, CancellationToken cancellationToken) =>
        _auditLogService.AddAsync(new AuditEntry
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            ActorUserId = actor,
            OldValues = oldValues,
            NewValues = newValues,
        }, cancellationToken);
}
