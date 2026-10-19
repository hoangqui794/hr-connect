using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Application.Features.Finance.Common;
using HRConnect.Application.Features.Jobs.Common;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Sourcing;

// MF-03 (CV_SOURCING): Internal HR hands qualified CVs to the Client; the Client accepts or rejects
// each one within the review window (default 7 days); no answer counts as accepted. Only accepted
// CVs are billed. See HRConnect/docs/main-flows.md (MF-03, CV_SOURCING) and QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md section 2.

public sealed record SourcingDeliveryDto(
    Guid DeliveryId,
    Guid ApplicationId,
    string? CandidateName,
    string Status,
    DateTime DeliveredAt,
    DateTime ReviewDueAt,
    int? DaysLeft,
    DateTime? DecidedAt,
    string? RejectReasonCode,
    string? RejectNote,
    Guid? ReplacedByDeliveryId);

public sealed record SourcingSummaryDto(
    int? SourcingTarget, int Delivered, int Accepted, int AutoAccepted, int Rejected, int PendingReview, int Counted);

public sealed record SourcingDeliveriesResponse(SourcingSummaryDto Summary, IReadOnlyList<SourcingDeliveryDto> Items);

public sealed record DeliverCvsResponse(IReadOnlyList<SourcingDeliveryDto> Delivered, SourcingSummaryDto Summary);

/// <summary>Internal HR hands shortlisted CVs of a CV_SOURCING job to the Client.</summary>
public sealed record DeliverSourcingCvsCommand(Guid JobId, IReadOnlyList<Guid> ApplicationIds, Guid CurrentUserId)
    : IRequest<DeliverCvsResponse>;

/// <summary>The Client accepts or rejects one delivered CV.</summary>
public sealed record DecideSourcingDeliveryCommand(
    Guid JobId, Guid DeliveryId, string Decision, string? ReasonCode, string? Note, Guid CurrentUserId)
    : IRequest<SourcingDeliveryDto>;

/// <summary>Internal HR verifies a rejection with reason OTHER: upheld keeps it rejected, otherwise it counts as accepted.</summary>
public sealed record ReviewSourcingRejectionCommand(Guid JobId, Guid DeliveryId, bool Upheld, string? Note, Guid CurrentUserId)
    : IRequest<SourcingDeliveryDto>;

/// <summary>Internal HR swaps a validly rejected CV for another qualified one.</summary>
public sealed record ReplaceSourcingDeliveryCommand(Guid JobId, Guid DeliveryId, Guid ApplicationId, Guid CurrentUserId)
    : IRequest<SourcingDeliveryDto>;

/// <summary>Deliveries of a job. <see cref="ClientUserId"/> set means a Client is asking (company scope).</summary>
public sealed record GetSourcingDeliveriesQuery(Guid JobId, Guid? ClientUserId, string? Status)
    : IRequest<SourcingDeliveriesResponse>;

public static class SourcingDeliveryAudit
{
    public const string Delivered = "SOURCING_CV_DELIVERED";
    public const string Decided = "SOURCING_DELIVERY_DECIDED";
    public const string RejectionReviewed = "SOURCING_REJECTION_REVIEWED";
    public const string Replaced = "SOURCING_DELIVERY_REPLACED";
    public const string AutoAccepted = "SOURCING_DELIVERY_AUTO_ACCEPTED";
    public const string EntityType = "SOURCING_DELIVERY";
}

internal static class SourcingDeliveryRules
{
    public const string ConsentConfirmed = "CONFIRMED";

    public static SourcingDeliveryDto ToDto(SourcingDelivery d, DateTime now) => new(
        d.DeliveryId,
        d.ApplicationId,
        d.Application?.Candidate?.FullName,
        d.Status,
        d.DeliveredAt,
        d.ReviewDueAt,
        d.Status == SourcingDeliveryStates.Delivered
            ? Math.Max(0, (int)Math.Ceiling((d.ReviewDueAt - now).TotalDays))
            : null,
        d.DecidedAt,
        d.RejectReasonCode,
        d.RejectNote,
        d.ReplacedByDeliveryId);

    public static SourcingSummaryDto Summarize(int? target, IEnumerable<SourcingDelivery> deliveries)
    {
        var list = deliveries.ToList();
        int Count(string status) => list.Count(d => d.Status == status);
        return new SourcingSummaryDto(
            target,
            list.Count(d => d.Status != SourcingDeliveryStates.Replaced),
            Count(SourcingDeliveryStates.Accepted),
            Count(SourcingDeliveryStates.AutoAccepted),
            Count(SourcingDeliveryStates.Rejected),
            Count(SourcingDeliveryStates.Delivered),
            list.Count(d => SourcingDeliveryStates.Counted.Contains(d.Status)));
    }

    public static void RequireSourcingJob(Job job)
    {
        if (!string.Equals(job.ServiceType?.Code, ServiceTypeCodes.CvSourcing, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException("Chỉ job CV_SOURCING mới giao CV cho Client.", "JOB_NOT_SOURCING");
        }
    }

    /// <summary>Same checks for a first delivery and for a replacement.</summary>
    public static void RequireDeliverable(Domain.Entities.Application application, IEnumerable<SourcingDelivery> existing)
    {
        if (application.Status != ApplicationStates.Shortlisted)
        {
            throw new ConflictException(
                $"Hồ sơ {application.ApplicationId} chưa được Internal HR xác nhận đạt (SHORTLISTED).", "APPLICATION_NOT_QUALIFIED");
        }

        if (!string.Equals(application.Submission?.Consent?.Status, ConsentConfirmed, StringComparison.OrdinalIgnoreCase))
        {
            throw new ConflictException(
                $"Ứng viên của hồ sơ {application.ApplicationId} chưa xác nhận đồng ý gửi hồ sơ.", "CONSENT_NOT_CONFIRMED");
        }

        if (existing.Any(d => d.ApplicationId == application.ApplicationId && d.Status != SourcingDeliveryStates.Replaced))
        {
            throw new ConflictException($"Hồ sơ {application.ApplicationId} đã được giao trước đó.", "APPLICATION_ALREADY_DELIVERED");
        }
    }

    public static async Task RequireClientOwnsJobAsync(
        ICompanyUserRepository companyUsers, Job job, Guid userId, CancellationToken cancellationToken)
    {
        var companyUser = await companyUsers.GetByUserIdAsync(userId, cancellationToken);
        if (companyUser == null || companyUser.CompanyId != job.CompanyId)
        {
            // Same answer as a missing job: do not reveal other companies' jobs.
            throw new NotFoundException("Không tìm thấy công việc.");
        }
    }
}

public sealed class DeliverSourcingCvsCommandHandler : IRequestHandler<DeliverSourcingCvsCommand, DeliverCvsResponse>
{
    private readonly ISourcingDeliveryRepository _deliveries;
    private readonly IAdminBusinessSettings _settings;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;

    public DeliverSourcingCvsCommandHandler(
        ISourcingDeliveryRepository deliveries, IAdminBusinessSettings settings, IUnitOfWork unitOfWork, IAuditLogService audit)
    {
        _deliveries = deliveries;
        _settings = settings;
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<DeliverCvsResponse> Handle(DeliverSourcingCvsCommand request, CancellationToken cancellationToken)
    {
        var ids = request.ApplicationIds?.Distinct().ToList() ?? [];
        if (ids.Count == 0)
        {
            throw new BadRequestException("Chọn ít nhất một hồ sơ để giao cho Client.");
        }

        var job = await _deliveries.GetJobAsync(request.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy công việc.");
        SourcingDeliveryRules.RequireSourcingJob(job);
        if (job.Status != JobStatuses.Active)
        {
            throw new ConflictException("Chỉ giao CV khi job đang ACTIVE.", "JOB_NOT_ACTIVE");
        }

        var target = job.SourcingTarget ?? 0;
        var existing = await _deliveries.GetByJobAsync(job.JobId, cancellationToken);
        var occupied = existing.Count(d => SourcingDeliveryStates.Occupying.Contains(d.Status));
        if (occupied + ids.Count > target)
        {
            throw new ConflictException(
                $"Vượt số CV Client yêu cầu: đã giao {occupied}/{target}, còn giao được {Math.Max(0, target - occupied)}.",
                "SOURCING_TARGET_REACHED");
        }

        var applications = await _deliveries.GetApplicationsAsync(job.JobId, ids, cancellationToken);
        if (applications.Count != ids.Count)
        {
            throw new NotFoundException("Có hồ sơ không thuộc công việc này.");
        }

        foreach (var application in applications)
        {
            SourcingDeliveryRules.RequireDeliverable(application, existing);
        }

        // Review window: the job's agreed value (MF-01 approval), the Admin default for older jobs.
        var reviewDays = job.ReviewDays is > 0
            ? job.ReviewDays.Value
            : await _settings.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, cancellationToken);
        var now = DateTime.UtcNow;
        var created = new List<SourcingDelivery>();
        foreach (var application in applications)
        {
            var delivery = new SourcingDelivery
            {
                DeliveryId = Guid.NewGuid(),
                JobId = job.JobId,
                ApplicationId = application.ApplicationId,
                Application = application,
                Status = SourcingDeliveryStates.Delivered,
                DeliveredAt = now,
                DeliveredBy = request.CurrentUserId,
                ReviewDueAt = now.AddDays(reviewDays),
                CreatedAt = now,
                UpdatedAt = now
            };
            await _deliveries.AddAsync(delivery, cancellationToken);
            await _audit.AddAsync(new AuditEntry
            {
                Action = SourcingDeliveryAudit.Delivered,
                EntityType = SourcingDeliveryAudit.EntityType,
                EntityId = delivery.DeliveryId,
                ActorUserId = request.CurrentUserId,
                NewValues = new { delivery.JobId, delivery.ApplicationId, delivery.ReviewDueAt, reviewDays }
            }, cancellationToken);
            created.Add(delivery);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new DeliverCvsResponse(
            created.Select(d => SourcingDeliveryRules.ToDto(d, now)).ToList(),
            SourcingDeliveryRules.Summarize(job.SourcingTarget, existing.Concat(created)));
    }
}

public sealed class DecideSourcingDeliveryCommandHandler : IRequestHandler<DecideSourcingDeliveryCommand, SourcingDeliveryDto>
{
    public const string DecisionAccepted = "ACCEPTED";
    public const string DecisionRejected = "REJECTED";

    private readonly ISourcingDeliveryRepository _deliveries;
    private readonly ICompanyUserRepository _companyUsers;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;
    private readonly ISourcingFinanceService? _finance;

    public DecideSourcingDeliveryCommandHandler(
        ISourcingDeliveryRepository deliveries, ICompanyUserRepository companyUsers, IUnitOfWork unitOfWork, IAuditLogService audit,
        ISourcingFinanceService? finance = null)
    {
        _deliveries = deliveries;
        _companyUsers = companyUsers;
        _unitOfWork = unitOfWork;
        _audit = audit;
        _finance = finance;
    }

    public async Task<SourcingDeliveryDto> Handle(DecideSourcingDeliveryCommand request, CancellationToken cancellationToken)
    {
        var decision = request.Decision?.Trim().ToUpperInvariant();
        if (decision is not (DecisionAccepted or DecisionRejected))
        {
            throw new BadRequestException("decision phải là ACCEPTED hoặc REJECTED.");
        }

        var reasonCode = request.ReasonCode?.Trim().ToUpperInvariant();
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (note?.Length > 2000)
        {
            throw new BadRequestException("Ghi chú tối đa 2000 ký tự.");
        }

        if (decision == DecisionRejected)
        {
            if (reasonCode == null || !SourcingRejectReasons.All.Contains(reasonCode))
            {
                throw new BadRequestException(
                    $"Từ chối phải chọn một lý do hợp lệ: {string.Join(", ", SourcingRejectReasons.All)}. " +
                    "Không chọn ứng viên để phỏng vấn không phải lý do từ chối.");
            }

            if (reasonCode == SourcingRejectReasons.Other && note == null)
            {
                throw new BadRequestException("Lý do OTHER bắt buộc có ghi chú.");
            }
        }

        var delivery = await _deliveries.GetByIdAsync(request.DeliveryId, cancellationToken);
        if (delivery == null || delivery.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy CV đã giao.");
        }

        await SourcingDeliveryRules.RequireClientOwnsJobAsync(_companyUsers, delivery.Job, request.CurrentUserId, cancellationToken);

        if (delivery.Status != SourcingDeliveryStates.Delivered)
        {
            throw new ConflictException($"CV này đã được xử lý ({delivery.Status}).", "DELIVERY_ALREADY_DECIDED");
        }

        var now = DateTime.UtcNow;
        if (now > delivery.ReviewDueAt)
        {
            throw new ConflictException("Đã hết thời hạn xem xét; CV được tính là đã chấp nhận.", "REVIEW_WINDOW_CLOSED");
        }

        delivery.Status = decision == DecisionAccepted ? SourcingDeliveryStates.Accepted : SourcingDeliveryStates.Rejected;
        delivery.DecidedAt = now;
        delivery.DecidedBy = request.CurrentUserId;
        delivery.RejectReasonCode = decision == DecisionRejected ? reasonCode : null;
        delivery.RejectNote = note;
        delivery.UpdatedAt = now;

        await _audit.AddAsync(new AuditEntry
        {
            Action = SourcingDeliveryAudit.Decided,
            EntityType = SourcingDeliveryAudit.EntityType,
            EntityId = delivery.DeliveryId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { Status = SourcingDeliveryStates.Delivered },
            NewValues = new { delivery.Status, delivery.RejectReasonCode, delivery.RejectNote }
        }, cancellationToken);
        if (_finance != null)
        {
            // MF-05: an accepted CV earns its commission and may complete the job's settlement.
            await _finance.OnDeliveryCountedAsync(delivery, request.CurrentUserId, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return SourcingDeliveryRules.ToDto(delivery, now);
    }
}

public sealed class ReviewSourcingRejectionCommandHandler : IRequestHandler<ReviewSourcingRejectionCommand, SourcingDeliveryDto>
{
    private readonly ISourcingDeliveryRepository _deliveries;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;

    private readonly ISourcingFinanceService? _finance;

    public ReviewSourcingRejectionCommandHandler(
        ISourcingDeliveryRepository deliveries, IUnitOfWork unitOfWork, IAuditLogService audit,
        ISourcingFinanceService? finance = null)
    {
        _deliveries = deliveries;
        _unitOfWork = unitOfWork;
        _audit = audit;
        _finance = finance;
    }

    public async Task<SourcingDeliveryDto> Handle(ReviewSourcingRejectionCommand request, CancellationToken cancellationToken)
    {
        var delivery = await _deliveries.GetByIdAsync(request.DeliveryId, cancellationToken);
        if (delivery == null || delivery.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy CV đã giao.");
        }

        if (delivery.Status != SourcingDeliveryStates.Rejected)
        {
            throw new ConflictException("Chỉ xác minh CV đang bị Client từ chối.", "DELIVERY_NOT_REJECTED");
        }

        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (!request.Upheld && note == null)
        {
            throw new BadRequestException("Bác bỏ lý do từ chối của Client bắt buộc có ghi chú.");
        }

        var now = DateTime.UtcNow;
        var oldReason = delivery.RejectReasonCode;
        if (!request.Upheld)
        {
            // The rejection was not valid: the CV counts as accepted and is billed.
            delivery.Status = SourcingDeliveryStates.Accepted;
            delivery.DecidedAt = now;
            delivery.DecidedBy = request.CurrentUserId;
            delivery.UpdatedAt = now;
        }

        await _audit.AddAsync(new AuditEntry
        {
            Action = SourcingDeliveryAudit.RejectionReviewed,
            EntityType = SourcingDeliveryAudit.EntityType,
            EntityId = delivery.DeliveryId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { Status = SourcingDeliveryStates.Rejected, RejectReasonCode = oldReason },
            NewValues = new { delivery.Status, request.Upheld, Note = note }
        }, cancellationToken);
        if (!request.Upheld && _finance != null)
        {
            await _finance.OnDeliveryCountedAsync(delivery, request.CurrentUserId, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return SourcingDeliveryRules.ToDto(delivery, now);
    }
}

public sealed class ReplaceSourcingDeliveryCommandHandler : IRequestHandler<ReplaceSourcingDeliveryCommand, SourcingDeliveryDto>
{
    private readonly ISourcingDeliveryRepository _deliveries;
    private readonly IAdminBusinessSettings _settings;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;

    public ReplaceSourcingDeliveryCommandHandler(
        ISourcingDeliveryRepository deliveries, IAdminBusinessSettings settings, IUnitOfWork unitOfWork, IAuditLogService audit)
    {
        _deliveries = deliveries;
        _settings = settings;
        _unitOfWork = unitOfWork;
        _audit = audit;
    }

    public async Task<SourcingDeliveryDto> Handle(ReplaceSourcingDeliveryCommand request, CancellationToken cancellationToken)
    {
        var old = await _deliveries.GetByIdAsync(request.DeliveryId, cancellationToken);
        if (old == null || old.JobId != request.JobId)
        {
            throw new NotFoundException("Không tìm thấy CV đã giao.");
        }

        if (old.Status != SourcingDeliveryStates.Rejected)
        {
            throw new ConflictException("Chỉ thay CV đã bị Client từ chối.", "DELIVERY_NOT_REJECTED");
        }

        SourcingDeliveryRules.RequireSourcingJob(old.Job);
        var existing = await _deliveries.GetByJobAsync(old.JobId, cancellationToken);
        var applications = await _deliveries.GetApplicationsAsync(old.JobId, [request.ApplicationId], cancellationToken);
        var application = applications.FirstOrDefault()
            ?? throw new NotFoundException("Hồ sơ thay thế không thuộc công việc này.");
        SourcingDeliveryRules.RequireDeliverable(application, existing);

        var reviewDays = await _settings.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays, cancellationToken);
        var now = DateTime.UtcNow;
        var replacement = new SourcingDelivery
        {
            DeliveryId = Guid.NewGuid(),
            JobId = old.JobId,
            ApplicationId = application.ApplicationId,
            Application = application,
            Status = SourcingDeliveryStates.Delivered,
            DeliveredAt = now,
            DeliveredBy = request.CurrentUserId,
            ReviewDueAt = now.AddDays(reviewDays),
            CreatedAt = now,
            UpdatedAt = now
        };
        await _deliveries.AddAsync(replacement, cancellationToken);

        old.Status = SourcingDeliveryStates.Replaced;
        old.ReplacedByDeliveryId = replacement.DeliveryId;
        old.UpdatedAt = now;

        await _audit.AddAsync(new AuditEntry
        {
            Action = SourcingDeliveryAudit.Replaced,
            EntityType = SourcingDeliveryAudit.EntityType,
            EntityId = old.DeliveryId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { Status = SourcingDeliveryStates.Rejected, old.ApplicationId },
            NewValues = new { Status = SourcingDeliveryStates.Replaced, ReplacedByDeliveryId = replacement.DeliveryId, replacement.ApplicationId }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return SourcingDeliveryRules.ToDto(replacement, now);
    }
}

public sealed class GetSourcingDeliveriesQueryHandler : IRequestHandler<GetSourcingDeliveriesQuery, SourcingDeliveriesResponse>
{
    private readonly ISourcingDeliveryRepository _deliveries;
    private readonly ICompanyUserRepository _companyUsers;

    public GetSourcingDeliveriesQueryHandler(ISourcingDeliveryRepository deliveries, ICompanyUserRepository companyUsers)
    {
        _deliveries = deliveries;
        _companyUsers = companyUsers;
    }

    public async Task<SourcingDeliveriesResponse> Handle(GetSourcingDeliveriesQuery request, CancellationToken cancellationToken)
    {
        var job = await _deliveries.GetJobAsync(request.JobId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy công việc.");
        if (request.ClientUserId is Guid clientUserId)
        {
            await SourcingDeliveryRules.RequireClientOwnsJobAsync(_companyUsers, job, clientUserId, cancellationToken);
        }

        SourcingDeliveryRules.RequireSourcingJob(job);
        var all = await _deliveries.GetByJobAsync(job.JobId, cancellationToken);
        var status = request.Status?.Trim().ToUpperInvariant();
        var now = DateTime.UtcNow;
        var items = all
            .Where(d => status == null || d.Status == status)
            .OrderByDescending(d => d.DeliveredAt)
            .Select(d => SourcingDeliveryRules.ToDto(d, now))
            .ToList();

        return new SourcingDeliveriesResponse(SourcingDeliveryRules.Summarize(job.SourcingTarget, all), items);
    }
}

public interface ISourcingAutoAcceptService
{
    /// <summary>Accepts one delivery whose review window has ended. Returns false if it no longer applies.</summary>
    Task<bool> AutoAcceptAsync(Guid deliveryId, DateTime now, CancellationToken cancellationToken = default);
}

public sealed class SourcingAutoAcceptService : ISourcingAutoAcceptService
{
    private readonly ISourcingDeliveryRepository _deliveries;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;

    private readonly ISourcingFinanceService? _finance;

    public SourcingAutoAcceptService(
        ISourcingDeliveryRepository deliveries, IUnitOfWork unitOfWork, IAuditLogService audit,
        ISourcingFinanceService? finance = null)
    {
        _deliveries = deliveries;
        _unitOfWork = unitOfWork;
        _audit = audit;
        _finance = finance;
    }

    public async Task<bool> AutoAcceptAsync(Guid deliveryId, DateTime now, CancellationToken cancellationToken = default)
    {
        var delivery = await _deliveries.GetByIdAsync(deliveryId, cancellationToken);
        if (delivery == null || delivery.Status != SourcingDeliveryStates.Delivered || delivery.ReviewDueAt > now)
        {
            return false;
        }

        delivery.Status = SourcingDeliveryStates.AutoAccepted;
        delivery.DecidedAt = now;
        delivery.UpdatedAt = now;
        await _audit.AddAsync(new AuditEntry
        {
            Action = SourcingDeliveryAudit.AutoAccepted,
            EntityType = SourcingDeliveryAudit.EntityType,
            EntityId = delivery.DeliveryId,
            ActorType = AuditActorTypes.Service,
            OldValues = new { Status = SourcingDeliveryStates.Delivered },
            NewValues = new { delivery.Status, delivery.ReviewDueAt }
        }, cancellationToken);
        if (_finance != null)
        {
            await _finance.OnDeliveryCountedAsync(delivery, null, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
