using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Queries;
using HRConnect.Application.Features.Recruitment.Common;
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
    DateTime? ExtendedAt,
    Guid? FilledByPlacementId,
    string? ReplacementCandidateName,
    DateTime? ClosedAt,
    string? CancelReason,
    Guid ConcurrencyToken,
    DateTime CreatedAt,
    string? JobTitle = null,
    string? CompanyName = null,
    decimal? RefundPercent = null,
    Guid? RefundServiceFeeId = null,
    decimal? RefundAmount = null,
    string? RefundStatus = null,
    DateTime? CancelRequestedAt = null,
    string? CancelRequestReason = null);

/// <summary>
/// Slots of one job. <paramref name="ClientUserId"/> is set for a Client caller, who may only
/// see jobs of their own company.
/// </summary>
public sealed record GetJobReplacementSlotsQuery(Guid JobId, Guid? ClientUserId) : IRequest<IReadOnlyList<ReplacementSlotDto>>;

/// <summary>
/// Slots across jobs, paged. <paramref name="ClientUserId"/> is set for a Client caller, who only
/// sees slots of their own company's jobs; platform roles see every company.
/// </summary>
public sealed record GetReplacementSlotsQuery(Guid? ClientUserId, Guid? JobId, string? Status, int Page, int PageSize)
    : IRequest<PagedResult<ReplacementSlotDto>>;

/// <summary>Internal HR cancels a WAITING_PAYMENT or OPEN slot (S4), e.g. the Client no longer needs a replacement. No refund.</summary>
public sealed record CancelReplacementSlotCommand(
    Guid ReplacementSlotId, string Reason, Guid ConcurrencyToken, Guid CurrentUserId) : IRequest<ReplacementSlotDto>;

/// <summary>Client requests cancellation of an OPEN or WAITING_PAYMENT slot; Internal HR reviews and finalizes cancellation.</summary>
public sealed record RequestCancelReplacementSlotCommand(
    Guid ReplacementSlotId, string Reason, Guid ConcurrencyToken, Guid ClientUserId) : IRequest<ReplacementSlotDto>;

public sealed class GetJobReplacementSlotsQueryHandler : IRequestHandler<GetJobReplacementSlotsQuery, IReadOnlyList<ReplacementSlotDto>>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IAdminBusinessSettings? _settings;

    public GetJobReplacementSlotsQueryHandler(
        IFinanceRepository financeRepository,
        ICompanyUserRepository companyUserRepository,
        IAdminBusinessSettings? settings = null)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
        _settings = settings;
    }

    public async Task<IReadOnlyList<ReplacementSlotDto>> Handle(GetJobReplacementSlotsQuery request, CancellationToken cancellationToken)
    {
        Guid? clientCompanyId = null;
        if (request.ClientUserId is Guid clientUserId)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(clientUserId, cancellationToken);
            if (!CompanyMembershipPolicy.IsActive(companyUser))
            {
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            clientCompanyId = companyUser.CompanyId;
        }

        var companyId = await _financeRepository.GetJobCompanyIdAsync(request.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy job.");
        if (clientCompanyId is Guid expectedCompanyId && expectedCompanyId != companyId)
        {
            // Same answer as a missing job: do not reveal other companies' jobs.
            throw new NotFoundException("Không tìm thấy job.");
        }

        var slots = await _financeRepository.GetReplacementSlotsByJobAsync(request.JobId, cancellationToken);
        return await ReplacementSlotMapping.MapListAsync(slots, _financeRepository, _settings, cancellationToken);
    }
}

public sealed class GetReplacementSlotsQueryHandler : IRequestHandler<GetReplacementSlotsQuery, PagedResult<ReplacementSlotDto>>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IAdminBusinessSettings? _settings;

    public GetReplacementSlotsQueryHandler(
        IFinanceRepository financeRepository,
        ICompanyUserRepository companyUserRepository,
        IAdminBusinessSettings? settings = null)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
        _settings = settings;
    }

    public async Task<PagedResult<ReplacementSlotDto>> Handle(GetReplacementSlotsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        Guid? companyId = null;
        if (request.ClientUserId is Guid clientUserId)
        {
            // A deactivated member keeps its company_user row, so membership must be ACTIVE to read slots.
            var companyUser = await _companyUserRepository.GetByUserIdAsync(clientUserId, cancellationToken);
            if (!CompanyMembershipPolicy.IsActive(companyUser))
            {
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            companyId = companyUser.CompanyId;
        }

        var status = string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim().ToUpperInvariant();
        var (items, total) = await _financeRepository.GetReplacementSlotsAsync(
            companyId, request.JobId, status, page, pageSize, cancellationToken);
        var dtos = await ReplacementSlotMapping.MapListAsync(items, _financeRepository, _settings, cancellationToken);
        return new PagedResult<ReplacementSlotDto>(dtos, total, page, pageSize);
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

public sealed class RequestCancelReplacementSlotCommandHandler : IRequestHandler<RequestCancelReplacementSlotCommand, ReplacementSlotDto>
{
    private readonly IFinanceRepository _financeRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly IAppNotifier? _notifier;

    public RequestCancelReplacementSlotCommandHandler(
        IFinanceRepository financeRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        IAppNotifier? notifier = null)
    {
        _financeRepository = financeRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _notifier = notifier;
    }

    public async Task<ReplacementSlotDto> Handle(RequestCancelReplacementSlotCommand request, CancellationToken cancellationToken)
    {
        var companyUser = await _companyUserRepository.GetByUserIdAsync(request.ClientUserId, cancellationToken);
        if (!CompanyMembershipPolicy.IsActive(companyUser))
        {
            throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
        }

        var reason = request.Reason?.Trim();
        if (string.IsNullOrEmpty(reason) || reason.Length > 500)
        {
            throw new BadRequestException("Lý do hủy suất thay thế là bắt buộc và tối đa 500 ký tự.");
        }

        var slot = await _financeRepository.GetReplacementSlotForUpdateAsync(request.ReplacementSlotId, cancellationToken);
        if (slot == null || slot.Job == null || slot.Job.CompanyId != companyUser.CompanyId)
        {
            throw new NotFoundException("Không tìm thấy suất thay thế.");
        }

        if (slot.ConcurrencyToken != request.ConcurrencyToken)
        {
            throw new ConflictException(
                "Suất thay thế vừa được cập nhật bởi người khác. Tải lại rồi thử lại.",
                ReplacementSlotErrorCodes.ConcurrencyConflict);
        }

        if (slot.Status is not (ReplacementSlotStates.WaitingPayment or ReplacementSlotStates.Open))
        {
            throw new ConflictException(
                $"Chỉ yêu cầu hủy được suất WAITING_PAYMENT hoặc OPEN. Trạng thái hiện tại: {slot.Status}.",
                ReplacementSlotErrorCodes.NotCancellable);
        }

        if (slot.CancelRequestedAt != null)
        {
            throw new ConflictException("Yêu cầu hủy suất này đã được gửi trước đó và đang chờ HR Connect xử lý.");
        }

        var now = DateTime.UtcNow;
        slot.CancelRequestedAt = now;
        slot.CancelRequestedBy = request.ClientUserId;
        slot.CancelRequestReason = reason;
        slot.ConcurrencyToken = Guid.NewGuid();
        slot.UpdatedAt = now;

        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ReplacementSlotCancelRequested,
            EntityType = "REPLACEMENT_SLOT",
            EntityId = slot.ReplacementSlotId,
            ActorUserId = request.ClientUserId,
            OldValues = new { status = slot.Status, cancelRequestedAt = (DateTime?)null },
            NewValues = new { status = slot.Status, cancelRequestedAt = now, reason },
        }, cancellationToken);

        if (_notifier != null)
        {
            await _notifier.NotifyRoleAsync(
                "INTERNAL_HR",
                new AppNotice(
                    "WARRANTY",
                    "Doanh nghiệp yêu cầu hủy suất thay thế",
                    $"Doanh nghiệp {slot.Job?.Company?.CompanyName} yêu cầu hủy suất thay thế cho vị trí \"{slot.Job?.Title}\". Lý do: {reason}",
                    "REPLACEMENT_SLOT",
                    slot.ReplacementSlotId,
                    "/hr/warranty-tracking"),
                cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return ReplacementSlotMapping.ToDto(slot);
    }
}

internal static class ReplacementSlotMapping
{
    public static ReplacementSlotDto ToDto(ReplacementSlot slot) => ToDto(slot, null, null);

    public static ReplacementSlotDto ToDto(ReplacementSlot slot, ServiceFee? refundFee, decimal? defaultRefundPercent)
    {
        var refundPercent = refundFee != null
            ? decimal.Round(refundFee.FeeMultiplier * 100m, 2)
            : defaultRefundPercent;
        return new(
            slot.ReplacementSlotId,
            slot.JobId,
            slot.Status,
            slot.OriginalPlacementId,
            slot.OriginalPlacement?.Application?.Candidate?.FullName,
            slot.ServiceFeeId,
            slot.FillWindowDays,
            slot.OpenedAt,
            slot.ExpiresAt,
            slot.ExtendedAt,
            slot.FilledByPlacementId,
            slot.FilledByPlacement?.Application?.Candidate?.FullName,
            slot.ClosedAt,
            slot.CancelReason,
            slot.ConcurrencyToken,
            slot.CreatedAt,
            slot.Job?.Title,
            slot.Job?.Company?.CompanyName,
            refundPercent,
            refundFee?.ServiceFeeId,
            refundFee?.Amount,
            refundFee?.Status,
            slot.CancelRequestedAt,
            slot.CancelRequestReason);
    }

    public static async Task<IReadOnlyList<ReplacementSlotDto>> MapListAsync(
        IReadOnlyList<ReplacementSlot> slots,
        IFinanceRepository financeRepository,
        IAdminBusinessSettings? settings,
        CancellationToken cancellationToken)
    {
        if (slots.Count == 0)
        {
            return Array.Empty<ReplacementSlotDto>();
        }

        var jobIds = slots.Select(s => s.JobId).Distinct().ToList();
        var jobFees = await financeRepository.GetJobServiceFeesAsync(jobIds, cancellationToken) ?? Array.Empty<ServiceFee>();
        var refundFees = jobFees.Where(f => f.Kind == ServiceFeeKinds.ReplacementRefund).ToList();
        var defaultPercent = settings != null
            ? await settings.GetDecimalAsync(BusinessSettingKeys.ReplacementRefundPercent, cancellationToken)
            : (decimal?)null;

        return slots.Select(slot =>
        {
            var refund = FindRefundForSlot(slot, refundFees);
            return ToDto(slot, refund, defaultPercent);
        }).ToList();
    }

    private static ServiceFee? FindRefundForSlot(ReplacementSlot slot, IReadOnlyList<ServiceFee> refundFees)
    {
        // A refund is only created when a slot expires, so an OPEN/FILLED slot of the same job and amount never has one.
        if (slot.Status != ReplacementSlotStates.Expired)
        {
            return null;
        }

        var sameJob = refundFees.Where(fee => fee.JobId == slot.JobId).ToList();
        if (sameJob.Count == 0)
        {
            return null;
        }

        return sameJob
            .Where(fee => slot.ServiceFee != null
                ? fee.BaseSalary == slot.ServiceFee.Amount
                : sameJob.Count == 1)
            .OrderBy(fee => Math.Abs(((slot.ClosedAt ?? slot.UpdatedAt) - fee.CreatedAt).Ticks))
            .FirstOrDefault();
    }

    public static ReplacementSummaryDto ToSummary(ReplacementSlot slot) =>
        new(slot.ReplacementSlotId, slot.JobId, slot.Status, slot.ExpiresAt);
}
