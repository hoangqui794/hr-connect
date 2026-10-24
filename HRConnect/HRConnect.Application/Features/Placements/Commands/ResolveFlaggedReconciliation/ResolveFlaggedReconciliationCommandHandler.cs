using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Constants;
using MediatR;

namespace HRConnect.Application.Features.Placements.Commands.ResolveFlaggedReconciliation;

public sealed class ResolveFlaggedReconciliationCommandHandler : IRequestHandler<ResolveFlaggedReconciliationCommand, ResolveFlaggedReconciliationResponse>
{
    private readonly IPlacementReconciliationRepository _repository;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IWarrantyProgressService _warrantyProgress;
    private readonly IAdminBusinessSettings _settings;

    public ResolveFlaggedReconciliationCommandHandler(
        IPlacementReconciliationRepository repository,
        IAuditLogService audit,
        IUnitOfWork unitOfWork,
        IWarrantyProgressService warrantyProgress,
        IAdminBusinessSettings settings)
    {
        _repository = repository;
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

        var item = await _repository.GetByApplicationIdAsync(request.ApplicationId, cancellationToken: cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ đối soát kết quả nhận việc.");
        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, item.ConcurrencyToken, "đối soát placement");
        if (item.Status != PlacementReconciliationStates.Flagged)
        {
            throw new ConflictException("Chỉ có thể giải quyết hồ sơ đang cần xử lý.", PlacementReconciliationErrorCodes.NotPending);
        }

        var now = DateTime.UtcNow;
        item.Status = PlacementReconciliationStates.Confirmed;
        item.ResolutionNote = note;
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
            NewValues = new { status = item.Status, resolutionNote = note }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        if (item.Placement?.ServiceFee is { } fee)
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

        return new ResolveFlaggedReconciliationResponse(item.ReconciliationId, item.ApplicationId, item.Status, item.ConcurrencyToken, now);
    }
}
