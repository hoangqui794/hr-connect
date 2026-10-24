using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.ConfirmStartWork;

public class ConfirmStartWorkCommandHandler : IRequestHandler<ConfirmStartWorkCommand, ConfirmStartWorkResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly IOfferRepository _offerRepository;
    private readonly IPlacementRepository _placementRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ConfirmStartWorkCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;
    private readonly IPlacementFinanceService _placementFinanceService;
    private readonly IFinanceRepository _financeRepository;
    private readonly IPlacementReconciliationRepository _reconciliationRepository;

    public ConfirmStartWorkCommandHandler(
        IApplicationRepository applicationRepository,
        IOfferRepository offerRepository,
        IPlacementRepository placementRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<ConfirmStartWorkCommandHandler> logger,
        IAuditLogService auditLogService,
        IPlacementFinanceService placementFinanceService,
        IFinanceRepository financeRepository,
        IPlacementReconciliationRepository reconciliationRepository)
    {
        _applicationRepository = applicationRepository;
        _offerRepository = offerRepository;
        _placementRepository = placementRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
        _placementFinanceService = placementFinanceService;
        _financeRepository = financeRepository;
        _reconciliationRepository = reconciliationRepository;
    }

    public async Task<ConfirmStartWorkResponse> Handle(ConfirmStartWorkCommand request, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.ActualStartDate > today)
        {
            throw new BadRequestException(
                "Ngày thực tế đi làm không được ở tương lai.",
                PlacementStartDateErrorCodes.InvalidStartDate);
        }


        var position = Mf04InputPolicy.NormalizeOptionalText(
            request.Position,
            Mf04InputPolicy.PlacementPositionMaxLength,
            "Vị trí tiếp nhận");
        var department = Mf04InputPolicy.NormalizeOptionalText(
            request.Department,
            Mf04InputPolicy.PlacementDepartmentMaxLength,
            "Bộ phận tiếp nhận");

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển {ApplicationId}.", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, application.ConcurrencyToken, "hồ sơ");

        if (application.Status != ApplicationStates.OfferAccepted)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể xác nhận đi làm.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Chỉ có thể xác nhận đi làm khi hồ sơ ở trạng thái {ApplicationStates.OfferAccepted}. Trạng thái hiện tại: {application.Status}.");
        }

        var existingPlacement = await _placementRepository.GetByApplicationIdAsync(request.ApplicationId, cancellationToken);
        if (existingPlacement != null)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đã có Placement {PlacementId}.",
                request.ApplicationId, existingPlacement.PlacementId);
            throw new ConflictException("Hồ sơ ứng tuyển này đã có thông tin tiếp nhận việc (Placement).");
        }

        var offer = await _offerRepository.GetByIdAsync(request.OfferId, cancellationToken);
        if (offer == null || offer.ApplicationId != application.ApplicationId)
        {
            _logger.LogWarning("Thư mời nhận việc {OfferId} không tồn tại hoặc không thuộc hồ sơ {ApplicationId}.",
                request.OfferId, request.ApplicationId);
            throw new BadRequestException("Thư mời nhận việc không tồn tại hoặc không thuộc hồ sơ này.");
        }

        if (!string.Equals(offer.Status, OfferStates.Accepted, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Thư mời nhận việc {OfferId} chưa được chấp thuận (Status: {Status}).",
                offer.OfferId, offer.Status);
            throw new BadRequestException($"Chỉ có thể xác nhận bắt đầu làm việc khi thư mời nhận việc đã được chấp nhận (ACCEPTED). Trạng thái hiện tại: {offer.Status}.");
        }

        // A live offer response always records RespondedAt. UpdatedAt is a safe fallback
        // for legacy ACCEPTED offers created before that field was consistently populated.
        var acceptedAt = offer.RespondedAt ??
            (offer.UpdatedAt == default ? (DateTime?)null : offer.UpdatedAt);
        if (acceptedAt.HasValue && request.ActualStartDate < DateOnly.FromDateTime(acceptedAt.Value))
        {
            throw new BadRequestException(
                "Ngày thực tế đi làm không được sớm hơn ngày ứng viên chấp nhận offer.",
                PlacementStartDateErrorCodes.InvalidStartDate);
        }

        Job job;
        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(companyUser))
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            job = application.Job;
            if (job == null)
            {
                _logger.LogError(
                    "Hồ sơ ứng tuyển {ApplicationId} không còn liên kết tới Job {JobId}.",
                    application.ApplicationId,
                    application.JobId);
                throw new ConflictException("Hồ sơ ứng tuyển không còn liên kết với công việc hợp lệ. Vui lòng liên hệ quản trị viên.");
            }

            if (job.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố xác nhận đi làm cho hồ sơ của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, job.CompanyId);
                throw new ForbiddenException("Bạn không có quyền xác nhận đi làm cho ứng viên của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền xác nhận bắt đầu làm việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền xác nhận ứng viên bắt đầu làm việc.");
        }

        var now = DateTime.UtcNow;
        var replacementCandidate = application.ReplacementSlotId.HasValue;
        var fillsReplacementSlot = replacementCandidate && !request.AcceptAsNewHire;
        var acceptedAsNewHire = replacementCandidate && request.AcceptAsNewHire;
        ReplacementSlot? replacementSlot = null;
        ServiceFee? replacementSourceFee = null;
        var replacementTransactionActive = false;

        try
        {
            if (fillsReplacementSlot)
            {
                // Locking happens before a placement is added. A concurrent Client request
                // waits here, then observes FILLED and gets a stable 409 response.
                await _unitOfWork.BeginTransactionAsync(cancellationToken);
                replacementTransactionActive = true;
                replacementSlot = await _financeRepository.GetReplacementSlotForPlacementForUpdateAsync(
                    application.ReplacementSlotId!.Value,
                    cancellationToken);

                if (!IsOpenAndUsableForJob(replacementSlot, job.JobId, now))
                {
                    throw ReplacementSlotAlreadyFilled();
                }

                replacementSourceFee = await _financeRepository.GetServiceFeeForUpdateAsync(
                    replacementSlot!.ServiceFeeId,
                    cancellationToken);
                if (!string.Equals(replacementSourceFee?.Status, ServiceFeeStates.Paid, StringComparison.OrdinalIgnoreCase))
                {
                    throw ReplacementSlotAlreadyFilled();
                }
            }

            var oldStatus = application.Status;
            var newConcurrencyToken = Guid.NewGuid();
            var placement = new Placement
            {
                PlacementId = Guid.NewGuid(),
                ApplicationId = application.ApplicationId,
                OfferId = offer.OfferId,
                ActualStartDate = request.ActualStartDate,
                Position = position ?? job.Title,
                Department = department,
                Status = PlacementStates.Started,
                ConfirmedBy = request.CurrentUserId,
                ConfirmedAt = now,
                ConfirmationNote = request.ConfirmationNote?.Trim(),
                CreatedAt = now,
                UpdatedAt = now,
                ReplacementSlotId = replacementSlot?.ReplacementSlotId
            };

            await _placementRepository.AddAsync(placement, cancellationToken);

            // MF-05 creates the new warranty and replacement commission in this unit
            // of work. Passing the source fee suppresses a second service-fee record.
            var finance = await _placementFinanceService.InitializeAsync(
                placement,
                new JobApplicationContext(
                    application.ApplicationId,
                    job.CompanyId,
                    job.ServiceTypeId,
                    job.ServiceType?.Code,
                    offer,
                    job.FeeMultiplier,
                    job.WarrantyDays,
                    job.PaymentDueDays,
                    replacementSourceFee),
                request.CurrentUserId,
                cancellationToken);

            if (string.Equals(job.ServiceType?.Code, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
            {
                var reconciliation = await _reconciliationRepository.GetByApplicationIdAsync(
                    application.ApplicationId,
                    cancellationToken: cancellationToken);
                if (reconciliation == null)
                {
                    await _reconciliationRepository.AddAsync(new PlacementReconciliation
                    {
                        ReconciliationId = Guid.NewGuid(),
                        ApplicationId = application.ApplicationId,
                        PlacementId = placement.PlacementId,
                        ClaimedOutcome = PlacementReconciliationOutcomes.Started,
                        Status = PlacementReconciliationStates.Pending,
                        ConcurrencyToken = Guid.NewGuid(),
                        CreatedAt = now,
                        UpdatedAt = now
                    }, cancellationToken);
                }
                else
                {
                    EnsureReopenedReconciliation(reconciliation);
                    ResetReconciliation(reconciliation, PlacementReconciliationOutcomes.Started, placement.PlacementId, now);
                }
            }

            if (replacementSlot != null)
            {
                replacementSlot.Status = ReplacementSlotStates.Filled;
                replacementSlot.FilledByPlacementId = placement.PlacementId;
                replacementSlot.ClosedAt = now;
                replacementSlot.ClosedBy = request.CurrentUserId;
                replacementSlot.UpdatedAt = now;
                replacementSlot.ConcurrencyToken = Guid.NewGuid();
            }

            application.Status = ApplicationStates.Placed;
            application.UpdatedAt = now;
            application.ConcurrencyToken = newConcurrencyToken;

            application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
            {
                ApplicationStatusHistoryId = Guid.NewGuid(),
                ApplicationId = application.ApplicationId,
                OldStatus = oldStatus,
                NewStatus = ApplicationStates.Placed,
                ChangedBy = request.CurrentUserId,
                ChangedAt = now,
                Reason = request.ConfirmationNote?.Trim() ?? "Xác nhận ứng viên đã bắt đầu làm việc (Placement started)."
            });

            _applicationRepository.Update(application);
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.PlacementConfirmed,
                EntityType = "PLACEMENT",
                EntityId = placement.PlacementId,
                ActorUserId = request.CurrentUserId,
                NewValues = new
                {
                    applicationId = application.ApplicationId,
                    offerId = offer.OfferId,
                    actualStartDate = placement.ActualStartDate,
                    status = placement.Status,
                    position = placement.Position,
                    department = placement.Department,
                    isReplacement = replacementSlot != null,
                    replacementSlotId = placement.ReplacementSlotId,
                    replacesPlacementId = replacementSlot?.OriginalPlacementId,
                    acceptedAsNewHire
                }
            }, cancellationToken);

            if (replacementSlot != null)
            {
                await _auditLogService.AddAsync(new AuditEntry
                {
                    Action = AuditActions.ReplacementSlotFilled,
                    EntityType = "REPLACEMENT_SLOT",
                    EntityId = replacementSlot.ReplacementSlotId,
                    ActorUserId = request.CurrentUserId,
                    OldValues = new { status = ReplacementSlotStates.Open },
                    NewValues = new
                    {
                        status = replacementSlot.Status,
                        filledByPlacementId = placement.PlacementId,
                        replacementSlot.OriginalPlacementId
                    }
                }, cancellationToken);
            }
            else if (acceptedAsNewHire)
            {
                await _auditLogService.AddAsync(new AuditEntry
                {
                    Action = AuditActions.ReplacementAcceptedAsNewHire,
                    EntityType = "APPLICATION",
                    EntityId = application.ApplicationId,
                    ActorUserId = request.CurrentUserId,
                    NewValues = new
                    {
                        application.ReplacementSlotId,
                        placementId = placement.PlacementId,
                        reason = "CLIENT_ACCEPTED_AS_NEW_HIRE"
                    }
                }, cancellationToken);
            }

            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.ApplicationStatusChanged,
                EntityType = "APPLICATION",
                EntityId = application.ApplicationId,
                ActorUserId = request.CurrentUserId,
                OldValues = new { status = oldStatus },
                NewValues = new { status = application.Status, sourceAction = AuditActions.PlacementConfirmed }
            }, cancellationToken);

            if (replacementTransactionActive)
            {
                await _unitOfWork.CommitTransactionAsync(cancellationToken);
                replacementTransactionActive = false;
            }
            else
            {
                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }

            _logger.LogInformation("Đã xác nhận ứng viên bắt đầu làm việc cho hồ sơ {ApplicationId}, Placement {PlacementId}, IsReplacement {IsReplacement}.",
                application.ApplicationId, placement.PlacementId, replacementSlot != null);

            return new ConfirmStartWorkResponse(
                application.ApplicationId,
                application.Status,
                placement.PlacementId,
                placement.ActualStartDate,
                application.ConcurrencyToken,
                new List<string> { "VIEW_PLACEMENT" },
                finance.Applicable ? finance : null,
                replacementSlot != null,
                placement.ReplacementSlotId,
                replacementSlot?.OriginalPlacementId,
                acceptedAsNewHire
            );
        }
        catch
        {
            if (replacementTransactionActive)
            {
                await _unitOfWork.RollbackTransactionAsync(CancellationToken.None);
            }

            throw;
        }
    }

    private static void EnsureReopenedReconciliation(PlacementReconciliation reconciliation)
    {
        if (reconciliation.Status != PlacementReconciliationStates.Confirmed ||
            reconciliation.ResolutionAction != PlacementReconciliationResolutionActions.ReopenForClientConfirmation)
        {
            throw new ConflictException(
                "Hồ sơ đã có kết quả đối soát và không thể ghi đè.",
                PlacementReconciliationErrorCodes.NotPending);
        }
    }

    private static void ResetReconciliation(
        PlacementReconciliation reconciliation,
        string outcome,
        Guid? placementId,
        DateTime now)
    {
        reconciliation.PlacementId = placementId;
        reconciliation.ClaimedOutcome = outcome;
        reconciliation.Status = PlacementReconciliationStates.Pending;
        reconciliation.ContactChannel = null;
        reconciliation.Note = null;
        reconciliation.ResolutionNote = null;
        reconciliation.ResolutionAction = null;
        reconciliation.ReviewedBy = null;
        reconciliation.ReviewedAt = null;
        reconciliation.UpdatedAt = now;
        reconciliation.ConcurrencyToken = Guid.NewGuid();
    }

    private static bool IsOpenAndUsableForJob(ReplacementSlot? slot, Guid jobId, DateTime now) =>
        slot != null &&
        slot.JobId == jobId &&
        string.Equals(slot.Status, ReplacementSlotStates.Open, StringComparison.OrdinalIgnoreCase) &&
        slot.ExpiresAt.HasValue &&
        slot.ExpiresAt.Value > now;

    private static ConflictException ReplacementSlotAlreadyFilled() => new(
        "Suất thay thế không còn. Nếu vẫn nhận ứng viên này thì sẽ tính phí như tuyển mới.",
        ReplacementSlotErrorCodes.AlreadyFilled);
}
