using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Recruitment.Commands.MarkNotStarted;

public class MarkNotStartedCommandHandler : IRequestHandler<MarkNotStartedCommand, MarkNotStartedResponse>
{
    private readonly IApplicationRepository _applicationRepository;
    private readonly IPlacementRepository _placementRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<MarkNotStartedCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;
    private readonly IPlacementReconciliationRepository _reconciliationRepository;
    private readonly ICandidateRecruitmentDeliveryService? _candidateDeliveryService;
    private readonly IAppNotifier? _notifier;

    public MarkNotStartedCommandHandler(
        IApplicationRepository applicationRepository,
        IPlacementRepository placementRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<MarkNotStartedCommandHandler> logger,
        IAuditLogService auditLogService,
        IPlacementReconciliationRepository reconciliationRepository,
        ICandidateRecruitmentDeliveryService? candidateDeliveryService = null,
        IAppNotifier? notifier = null)
    {
        _applicationRepository = applicationRepository;
        _placementRepository = placementRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
        _reconciliationRepository = reconciliationRepository;
        _candidateDeliveryService = candidateDeliveryService;
        _notifier = notifier;
    }

    public async Task<MarkNotStartedResponse> Handle(MarkNotStartedCommand request, CancellationToken cancellationToken)
    {
        var reasonCode = ApplicationReasonCodes.Normalize(request.ReasonCode)
            ?? ApplicationReasonCodes.CandidateOther;
        if (!ApplicationReasonCodes.NotStartedCodes.Contains(reasonCode))
        {
            throw new BadRequestException("Mã lý do không bắt đầu làm việc không hợp lệ.");
        }

        var providedReason = request.Reason?.Trim();
        if ((reasonCode == ApplicationReasonCodes.CandidateOther || reasonCode == ApplicationReasonCodes.EmployerCancelled) && string.IsNullOrWhiteSpace(providedReason))
        {
            throw new BadRequestException("Vui lòng ghi rõ lý do khi chọn tình huống này.");
        }

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển {ApplicationId}.", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, application.ConcurrencyToken, "hồ sơ");

        if (string.Equals(application.Status, ApplicationStates.NotStarted, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đã ở trạng thái NOT_STARTED.", application.ApplicationId);
            throw new BadRequestException("Hồ sơ ứng tuyển đã ở trạng thái không nhận việc (NOT_STARTED).");
        }

        if (application.Status != ApplicationStates.OfferAccepted)
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể đánh dấu không nhận việc.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Chỉ có thể đánh dấu không nhận việc sau khi ứng viên chấp nhận offer ({ApplicationStates.OfferAccepted}). Trạng thái hiện tại: {application.Status}.");
        }

        var vietnamToday = VietnamTime.Today();
        if (reasonCode == ApplicationReasonCodes.CandidateNoShow &&
            (!application.PlannedStartDate.HasValue || vietnamToday < application.PlannedStartDate.Value))
        {
            throw new BadRequestException("Chỉ có thể chọn lý do không đến nhận việc từ ngày nhận việc dự kiến trở đi.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = application.Status;
        var newConcurrencyToken = Guid.NewGuid();
        var effectiveReason = string.IsNullOrWhiteSpace(providedReason)
            ? ApplicationReasonCodes.GetNotStartedLabel(reasonCode)
            : providedReason;

        var placement = await _placementRepository.GetByApplicationIdAsync(request.ApplicationId, cancellationToken);
        if (placement != null)
        {
            throw new ConflictException("Hồ sơ đã có Placement; không thể chuyển ngược sang NOT_STARTED.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(companyUser))
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (application.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố đánh dấu không nhận việc cho hồ sơ của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, application.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền đánh dấu không nhận việc cho ứng viên của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền đánh dấu ứng viên không nhận việc.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền đánh dấu ứng viên không nhận việc.");
        }

        application.Status = ApplicationStates.NotStarted;
        application.StatusReason = effectiveReason;
        application.StatusReasonCode = reasonCode;
        application.UpdatedAt = now;
        application.ConcurrencyToken = newConcurrencyToken;

        application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
        {
            ApplicationStatusHistoryId = Guid.NewGuid(),
            ApplicationId = application.ApplicationId,
            OldStatus = oldStatus,
            NewStatus = ApplicationStates.NotStarted,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = effectiveReason,
            ReasonCode = reasonCode
        });

        _applicationRepository.Update(application);

        if (string.Equals(application.Job?.ServiceType?.Code, ServiceTypeCodes.HeadhuntCod, StringComparison.OrdinalIgnoreCase))
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
                    ClaimedOutcome = PlacementReconciliationOutcomes.NotStarted,
                    Status = PlacementReconciliationStates.Pending,
                    ConcurrencyToken = Guid.NewGuid(),
                    CreatedAt = now,
                    UpdatedAt = now
                }, cancellationToken);
            }
            else
            {
                if (reconciliation.Status != PlacementReconciliationStates.Confirmed ||
                    reconciliation.ResolutionAction != PlacementReconciliationResolutionActions.ReopenForClientConfirmation)
                {
                    throw new ConflictException(
                        "Hồ sơ đã có kết quả đối soát và không thể ghi đè.",
                        PlacementReconciliationErrorCodes.NotPending);
                }

                reconciliation.PlacementId = null;
                reconciliation.ClaimedOutcome = PlacementReconciliationOutcomes.NotStarted;
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

            if (_notifier != null)
            {
                var candidateName = application.Candidate?.FullName ?? "ứng viên";
                var jobTitle = application.Job?.Title ?? "vị trí tuyển dụng";
                await _notifier.NotifyRoleAsync(
                    "INTERNAL_HR",
                    new AppNotice(
                        "SYSTEM",
                        "Cần đối soát báo cáo không nhận việc",
                        $"Doanh nghiệp báo {candidateName} không đi làm tại vị trí \"{jobTitle}\". Vui lòng đối soát xác minh.",
                        "PLACEMENT_RECONCILIATION",
                        application.ApplicationId,
                        $"/hr/placement-reconciliations?highlight={application.ApplicationId}"),
                    cancellationToken);
            }
        }
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationNotStarted,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = application.Status, reasonCode, hasReason = true }
        }, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.ApplicationStatusChanged,
            EntityType = "APPLICATION",
            EntityId = application.ApplicationId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus },
            NewValues = new { status = application.Status, sourceAction = AuditActions.ApplicationNotStarted }
        }, cancellationToken);

        CandidateRecruitmentDeliveryOutcome? deliveryOutcome = null;
        if (_candidateDeliveryService != null)
        {
            deliveryOutcome = await _candidateDeliveryService.DeliverApplicationOutcomeAsync(
                application,
                ApplicationCandidateDeliveryEvent.NotStartedReported,
                effectiveReason,
                now,
                cancellationToken: cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Đã đánh dấu hồ sơ {ApplicationId} thành NOT_STARTED. Lý do: {Reason}",
            application.ApplicationId, effectiveReason);

        return new MarkNotStartedResponse(
            application.ApplicationId,
            application.Status,
            application.StatusReason,
            application.ConcurrencyToken,
            application.UpdatedAt,
            deliveryOutcome?.Channel.ToApiValue()
        );
    }
}
