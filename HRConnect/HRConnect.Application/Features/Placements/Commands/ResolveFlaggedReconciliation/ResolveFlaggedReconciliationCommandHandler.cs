using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;

public sealed class ResolveFlaggedReconciliationCommandHandler : IRequestHandler<ResolveFlaggedReconciliationCommand, ResolveFlaggedReconciliationResponse>
{
    private readonly IPlacementReconciliationRepository _repository;
    private readonly IApplicationRepository _applications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IWarrantyProgressService _warrantyProgress;
    private readonly IAdminBusinessSettings _settings;

    public ResolveFlaggedReconciliationCommandHandler(
        IPlacementReconciliationRepository repository,
        IApplicationRepository applications,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IWarrantyProgressService warrantyProgress,
        IAdminBusinessSettings settings)
    {
        _repository = repository;
        _applications = applications;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _warrantyProgress = warrantyProgress;
        _settings = settings;
    }

    public async Task<ResolveFlaggedReconciliationResponse> Handle(ResolveFlaggedReconciliationCommand request, CancellationToken cancellationToken)
    {
        var note = request.Note?.Trim();
        if (string.IsNullOrWhiteSpace(note)) throw new BadRequestException("Ghi chú giải quyết là bắt buộc.", PlacementReconciliationErrorCodes.NoteRequired);
        if (note.Length > 1000) throw new BadRequestException("Ghi chú giải quyết không được vượt quá 1000 ký tự.");

        var action = string.IsNullOrWhiteSpace(request.Action)
            ? PlacementReconciliationResolutionActions.ConfirmReportedOutcome
            : request.Action.Trim().ToUpperInvariant();
        if (!PlacementReconciliationResolutionActions.All.Contains(action))
        {
            throw new BadRequestException(
                "Hành động giải quyết đối soát không hợp lệ.",
                PlacementReconciliationErrorCodes.InvalidResolutionAction);
        }

        var item = await _repository.GetByApplicationIdAsync(request.ApplicationId, cancellationToken: cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ đối soát kết quả nhận việc.");
        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, item.ConcurrencyToken, "đối soát placement");
        if (item.Status != PlacementReconciliationStates.Flagged)
        {
            throw new ConflictException("Chỉ có thể giải quyết hồ sơ đang cần xử lý.", PlacementReconciliationErrorCodes.NotPending);
        }

        var application = await _applications.GetByIdAsync(request.ApplicationId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển cần xử lý.");

        if (action == PlacementReconciliationResolutionActions.ReopenForClientConfirmation)
        {
            if (item.ClaimedOutcome != PlacementReconciliationOutcomes.NotStarted ||
                application.Status != ApplicationStates.NotStarted ||
                item.PlacementId.HasValue)
            {
                throw new ConflictException(
                    "Chỉ có thể mở lại hồ sơ do Client khai không nhận việc và chưa có Placement.",
                    PlacementReconciliationErrorCodes.InvalidResolutionAction);
            }

            var oldApplicationStatus = application.Status;
            application.Status = ApplicationStates.OfferAccepted;
            application.StatusReason = null;
            application.UpdatedAt = DateTime.UtcNow;
            application.ConcurrencyToken = Guid.NewGuid();
            application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
            {
                ApplicationStatusHistoryId = Guid.NewGuid(),
                ApplicationId = application.ApplicationId,
                OldStatus = oldApplicationStatus,
                NewStatus = ApplicationStates.OfferAccepted,
                ChangedBy = request.ActorUserId,
                ChangedAt = application.UpdatedAt,
                Reason = $"Platform Admin mở lại hồ sơ sau đối soát: {note}"
            });
            _applications.Update(application);
        }

        var now = DateTime.UtcNow;
        item.Status = PlacementReconciliationStates.Confirmed;
        item.ResolutionNote = note;
        item.ResolutionAction = action;
        item.ReviewedBy = request.ActorUserId;
        item.ReviewedAt = now;
        item.UpdatedAt = now;
        item.ConcurrencyToken = Guid.NewGuid();
        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.PlacementReconciliationResolved,
            EntityType = "PLACEMENT_RECONCILIATION",
            EntityId = item.ReconciliationId,
            ActorUserId = request.ActorUserId,
            OldValues = new { status = PlacementReconciliationStates.Flagged },
            NewValues = new
            {
                status = item.Status,
                resolutionAction = action,
                resolutionNote = note,
                applicationStatus = application.Status
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        if (action == PlacementReconciliationResolutionActions.ConfirmReportedOutcome &&
            item.Placement?.ServiceFee is { } fee)
        {
            var today = DateOnly.FromDateTime(now);
            if (fee.DueDate < today)
                await _warrantyProgress.MarkServiceFeeOverdueAsync(fee.ServiceFeeId, today, cancellationToken);
            else
                await _warrantyProgress.MarkServiceFeeDueAsync(
                    fee.ServiceFeeId,
                    today,
                    await _settings.GetIntAsync(BusinessSettingKeys.FeeDueReminderDays, cancellationToken),
                    cancellationToken);
        }

        return new ResolveFlaggedReconciliationResponse(
            item.ReconciliationId,
            item.ApplicationId,
            item.Status,
            action,
            application.Status,
            item.ConcurrencyToken,
            now);
    }
}
