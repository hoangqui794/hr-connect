using System.Text.Json;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Common.Settings;
using HRConnect.Domain.Constants;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.Disputes;

// SF-04 (minimal scope, docs/main-flows.md 6.1): an affiliate disputes a blocked duplicate or another
// affiliate's attribution; Platform Admin reviews and decides. UPHELD moves the attribution to the
// complainant (its unpaid commissions follow because they hang off the attribution).

/// <summary>What the complaining affiliate sees: never the other affiliate's name or id (D7).</summary>
public sealed record MyDisputeDto(
    Guid DisputeId, string DisputeType, string Status, Guid? SubmissionId, string? JobTitle, string? CandidateName,
    string Description, string? Resolution, DateTime CreatedAt, DateTime? ResolvedAt);

public sealed record AdminDisputeListItemDto(
    Guid DisputeId, string DisputeType, string Status, string? JobTitle, string? CandidateName,
    Guid RaisedBy, string? RaisedByAffiliateName, DateTime CreatedAt, DateTime? ResolvedAt,
    Guid ConcurrencyToken);

public sealed record DisputeSubmissionDto(
    Guid SubmissionId, Guid SubmittedBy, string? AffiliateName, string Source, string Status,
    DateTime SubmittedAt, string? ConsentStatus, DateTime? ConsentRespondedAt, bool IsDisputed);

public sealed record DisputeAttributionDto(
    Guid AttributionId, Guid AffiliateUserId, string? AffiliateName, Guid WinningSubmissionId, string AttributionRule,
    DateTime EstablishedAt, IReadOnlyList<string> CommissionStatuses, DateTime? PlacementConfirmedAt);

/// <summary>D4: identity, every submission of the candidate to the job, current attribution and evidence.</summary>
public sealed record AdminDisputeDetailDto(
    Guid DisputeId, string DisputeType, string Status, string Description, string Evidence,
    Guid RaisedBy, string? RaisedByAffiliateName, DateTime CreatedAt,
    Guid? JobId, string? JobTitle, Guid? CandidateId, string? CandidateName,
    string? CandidateNormalizedEmail, string? CandidateNormalizedPhone,
    IReadOnlyList<DisputeSubmissionDto> Submissions, DisputeAttributionDto? CurrentAttribution,
    Guid? CandidateDuplicateCaseId, Guid? ResolvedBy, string? Resolution, DateTime? ResolvedAt,
    Guid ConcurrencyToken);

public sealed record DisputePageDto(IReadOnlyList<AdminDisputeListItemDto> Items, int TotalCount, int Page, int PageSize);

public sealed record CreateDisputeCommand(
    Guid UserId, string DisputeType, Guid SubmissionId, string Description, string? EvidenceNote) : IRequest<MyDisputeDto>;

public sealed record GetMyDisputesQuery(Guid UserId, string? Status) : IRequest<IReadOnlyList<MyDisputeDto>>;

public sealed record GetAdminDisputesQuery(string? Status, string? Type, int Page, int PageSize) : IRequest<DisputePageDto>;

public sealed record GetAdminDisputeDetailQuery(Guid DisputeId) : IRequest<AdminDisputeDetailDto>;

public sealed record ResolveDisputeCommand(
    Guid DisputeId,
    string Decision,
    string Resolution,
    Guid AdminUserId,
    Guid ConcurrencyToken,
    string IdempotencyKey)
    : IRequest<AdminDisputeDetailDto>;

public sealed class DisputeHandlers :
    IRequestHandler<CreateDisputeCommand, MyDisputeDto>,
    IRequestHandler<GetMyDisputesQuery, IReadOnlyList<MyDisputeDto>>,
    IRequestHandler<GetAdminDisputesQuery, DisputePageDto>,
    IRequestHandler<GetAdminDisputeDetailQuery, AdminDisputeDetailDto>,
    IRequestHandler<ResolveDisputeCommand, AdminDisputeDetailDto>
{
    private const string BlockedDuplicate = "BLOCKED_DUPLICATE";
    private const int MaxTextLength = 2000;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly IDisputeRepository _disputes;
    private readonly ICandidateDuplicateRepository _duplicateCases;
    private readonly IAdminBusinessSettings _settings;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _audit;
    private readonly INotificationRepository _notifications;

    public DisputeHandlers(
        IDisputeRepository disputes, ICandidateDuplicateRepository duplicateCases,
        IAdminBusinessSettings settings, IUnitOfWork unitOfWork,
        IAuditLogService audit, INotificationRepository notifications)
    {
        _disputes = disputes;
        _duplicateCases = duplicateCases;
        _settings = settings;
        _unitOfWork = unitOfWork;
        _audit = audit;
        _notifications = notifications;
    }

    public async Task<MyDisputeDto> Handle(CreateDisputeCommand request, CancellationToken cancellationToken)
    {
        var type = request.DisputeType?.Trim().ToUpperInvariant();
        if (type == null || !DisputeTypes.All.Contains(type))
        {
            throw new BadRequestException($"disputeType phải là {string.Join(" hoặc ", DisputeTypes.All)}.");
        }

        var description = RequireText(request.Description, "Mô tả khiếu nại");
        var note = string.IsNullOrWhiteSpace(request.EvidenceNote) ? null : request.EvidenceNote.Trim();
        if (note?.Length > MaxTextLength)
        {
            throw new BadRequestException($"Bằng chứng tối đa {MaxTextLength} ký tự.");
        }
        ValidateEvidence(note);

        var submission = await _disputes.GetSubmissionAsync(request.SubmissionId, cancellationToken);
        if (submission == null || submission.SubmittedBy != request.UserId)
        {
            // Same answer for "missing" and "someone else's": do not reveal other affiliates' submissions.
            throw new BadRequestException("Chỉ khiếu nại được lượt nộp của chính bạn.", DisputeErrorCodes.NotEligible);
        }

        var attribution = await _disputes.GetAttributionForUpdateAsync(submission.CandidateId, submission.JobId, cancellationToken);
        DateTime windowStart;
        if (type == DisputeTypes.DuplicateSubmission)
        {
            if (!string.Equals(submission.Status, BlockedDuplicate, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestException("Chỉ khiếu nại trùng cho lượt nộp đã bị chặn trùng (BLOCKED_DUPLICATE).", DisputeErrorCodes.NotEligible);
            }

            windowStart = submission.SubmittedAt;
        }
        else
        {
            if (attribution == null || attribution.Affiliate.UserId == request.UserId)
            {
                throw new BadRequestException("Ứng viên này chưa có attribution của Affiliate khác để khiếu nại.", DisputeErrorCodes.NotEligible);
            }

            windowStart = attribution.Application.Placement?.ConfirmedAt ?? attribution.EstablishedAt;
        }

        var now = DateTime.UtcNow;
        var windowDays = await _settings.GetIntAsync(BusinessSettingKeys.DisputeWindowDays, cancellationToken);
        if (now > windowStart.AddDays(windowDays))
        {
            throw new ConflictException($"Đã quá {windowDays} ngày để khiếu nại lượt nộp này.", DisputeErrorCodes.WindowClosed);
        }

        if (await _disputes.HasActiveDisputeAsync(submission.SubmissionId, cancellationToken))
        {
            throw new ConflictException("Lượt nộp này đã có khiếu nại đang mở.", DisputeErrorCodes.AlreadyOpen);
        }

        var dispute = new Dispute
        {
            DisputeId = Guid.NewGuid(),
            DisputeType = type,
            SubmissionId = submission.SubmissionId,
            AttributionId = attribution?.AttributionId,
            // The commission at stake, so its approval is blocked while the dispute is open (D3).
            CommissionId = attribution?.Commissions
                .Where(c => c.Status is not (CommissionStates.Paid or CommissionStates.Cancelled))
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => (Guid?)c.CommissionId)
                .FirstOrDefault(),
            CandidateDuplicateCaseId = (await _duplicateCases.GetActiveSameJobCaseForSubmissionAsync(
                submission.SubmissionId, cancellationToken))?.DuplicateCaseId,
            RaisedBy = request.UserId,
            Description = description,
            Evidence = JsonSerializer.Serialize(
                note == null ? [] : new[] { new { type = IsLink(note) ? "LINK" : "NOTE", value = note, addedBy = request.UserId, addedAt = now } },
                Json),
            Status = DisputeStates.Open,
            CreatedAt = now,
            UpdatedAt = now,
            ConcurrencyToken = Guid.NewGuid()
        };
        await _disputes.AddAsync(dispute, cancellationToken);
        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.DisputeCreated,
            EntityType = "DISPUTE",
            EntityId = dispute.DisputeId,
            ActorUserId = request.UserId,
            NewValues = new { dispute.DisputeType, dispute.SubmissionId, dispute.AttributionId, dispute.CommissionId, dispute.Status }
        }, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return ToMine(dispute, submission);
    }

    public async Task<IReadOnlyList<MyDisputeDto>> Handle(GetMyDisputesQuery request, CancellationToken cancellationToken)
    {
        var items = await _disputes.GetRaisedByAsync(request.UserId, Upper(request.Status), cancellationToken);
        return items.Select(d => ToMine(d, d.Submission)).ToList();
    }

    public async Task<DisputePageDto> Handle(GetAdminDisputesQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var (items, total) = await _disputes.GetPageAsync(Upper(request.Status), Upper(request.Type), page, pageSize, cancellationToken);
        var names = await _disputes.GetAffiliateNamesByUserIdsAsync(items.Select(d => d.RaisedBy), cancellationToken);
        return new DisputePageDto(items.Select(d => new AdminDisputeListItemDto(
            d.DisputeId, d.DisputeType, d.Status, d.Submission?.Job?.Title, d.Submission?.Candidate?.FullName,
            d.RaisedBy, names.GetValueOrDefault(d.RaisedBy), d.CreatedAt, d.ResolvedAt,
            d.ConcurrencyToken)).ToList(), total, page, pageSize);
    }

    public async Task<AdminDisputeDetailDto> Handle(GetAdminDisputeDetailQuery request, CancellationToken cancellationToken)
    {
        var dispute = await _disputes.GetByIdAsync(request.DisputeId, cancellationToken)
            ?? throw new NotFoundException("Không tìm thấy khiếu nại.");
        return await ToDetailAsync(dispute, cancellationToken);
    }

    public async Task<AdminDisputeDetailDto> Handle(ResolveDisputeCommand request, CancellationToken cancellationToken)
    {
        var decision = request.Decision?.Trim().ToUpperInvariant();
        if (decision is not (DisputeStates.Upheld or DisputeStates.Rejected))
        {
            throw new BadRequestException("decision phải là UPHELD hoặc REJECTED.");
        }

        var resolution = RequireText(request.Resolution, "Lý do xử lý");
        var idempotencyKey = request.IdempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 100)
        {
            throw new BadRequestException("idempotencyKey là bắt buộc và tối đa 100 ký tự.");
        }

        await _unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var dispute = await _disputes.GetForUpdateAsync(request.DisputeId, cancellationToken)
                ?? throw new NotFoundException("Không tìm thấy khiếu nại.");
            if (string.Equals(dispute.ResolutionIdempotencyKey, idempotencyKey, StringComparison.Ordinal))
            {
                var existingResult = await ToDetailAsync(dispute, cancellationToken);
                await _unitOfWork.CommitTransactionAsync(cancellationToken);
                return existingResult;
            }
            if (!DisputeStates.Active.Contains(dispute.Status))
            {
                throw new ConflictException($"Khiếu nại đã được xử lý ({dispute.Status}).", DisputeErrorCodes.NotOpen);
            }
            if (dispute.ConcurrencyToken != request.ConcurrencyToken)
            {
                throw new ConflictException(
                    "Khiếu nại vừa được cập nhật. Vui lòng tải lại chi tiết mới nhất.",
                    DisputeErrorCodes.StaleResolution);
            }

            var now = DateTime.UtcNow;
            var oldStatus = dispute.Status;
            if (decision == DisputeStates.Upheld && dispute.Submission != null)
            {
                await TransferAttributionAsync(dispute, request.AdminUserId, now, cancellationToken);
            }

            dispute.Status = decision;
            dispute.Resolution = resolution;
            dispute.ResolvedBy = request.AdminUserId;
            dispute.ResolvedAt = now;
            dispute.UpdatedAt = now;
            dispute.ConcurrencyToken = Guid.NewGuid();
            dispute.ResolutionIdempotencyKey = idempotencyKey;

            await _audit.AddAsync(new AuditEntry
            {
                Action = AuditActions.DisputeResolved,
                EntityType = "DISPUTE",
                EntityId = dispute.DisputeId,
                ActorUserId = request.AdminUserId,
                OldValues = new { status = oldStatus },
                NewValues = new
                {
                    status = dispute.Status,
                    resolution,
                    dispute.AttributionId,
                    dispute.CandidateDuplicateCaseId,
                    idempotencyKey
                }
            }, cancellationToken);
            await NotifyAsync(dispute.RaisedBy, "Khiếu nại đã có kết quả",
                decision == DisputeStates.Upheld
                    ? $"Khiếu nại của bạn được chấp nhận. Lý do: {resolution}"
                    : $"Khiếu nại của bạn không được chấp nhận. Lý do: {resolution}",
                dispute.DisputeId, now, cancellationToken);

            await _unitOfWork.SaveChangesAsync(cancellationToken);
            var result = await ToDetailAsync(dispute, cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
            return result;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }
    }

    /// <summary>
    /// D5: the complainant becomes the attributed affiliate. Commissions hang off the attribution, so the
    /// unpaid ones move with it; a commission already PAID cannot be moved and must be settled outside first.
    /// </summary>
    private async Task TransferAttributionAsync(Dispute dispute, Guid adminUserId, DateTime now, CancellationToken cancellationToken)
    {
        var submission = dispute.Submission!;
        var attribution = await _disputes.GetAttributionForUpdateAsync(submission.CandidateId, submission.JobId, cancellationToken);
        var complainant = await _disputes.GetAffiliateByUserIdAsync(dispute.RaisedBy, cancellationToken);
        if (attribution == null)
        {
            throw new ConflictException(
                "Không tìm thấy attribution đang hoạt động để chuyển quyền giới thiệu.",
                DisputeErrorCodes.AttributionMissing);
        }
        if (complainant == null)
        {
            throw new ConflictException(
                "Tài khoản khiếu nại không còn hồ sơ Affiliate hợp lệ.",
                DisputeErrorCodes.AffiliateMissing);
        }
        if (attribution.AffiliateId == complainant.AffiliateId)
        {
            throw new ConflictException(
                "Quyền giới thiệu hiện đã thuộc Affiliate khiếu nại; không có thay đổi để thực hiện.",
                DisputeErrorCodes.TransferNotRequired);
        }

        if (attribution.Commissions.Any(c => c.Status == CommissionStates.Paid))
        {
            throw new ConflictException(
                "Hoa hồng của attribution này đã được chi; xử lý khoản đã chi ngoài hệ thống trước khi chấp nhận khiếu nại.",
                DisputeErrorCodes.CommissionAlreadyPaid);
        }

        var previousAffiliateId = attribution.AffiliateId;
        var previousUserId = attribution.Affiliate.UserId;
        var previousSubmissionId = attribution.WinningSubmissionId;
        attribution.AffiliateId = complainant.AffiliateId;
        attribution.WinningSubmissionId = submission.SubmissionId;
        attribution.AttributionRule = AttributionRules.DisputeResolution;
        attribution.UpdatedAt = now;
        dispute.AttributionId = attribution.AttributionId;

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.AttributionTransferred,
            EntityType = "ATTRIBUTION",
            EntityId = attribution.AttributionId,
            ActorUserId = adminUserId,
            OldValues = new { affiliateId = previousAffiliateId, winningSubmissionId = previousSubmissionId },
            NewValues = new
            {
                affiliateId = attribution.AffiliateId,
                winningSubmissionId = attribution.WinningSubmissionId,
                attribution.AttributionRule,
                disputeId = dispute.DisputeId,
                movedCommissions = attribution.Commissions.Where(c => c.Status != CommissionStates.Cancelled).Select(c => c.CommissionId)
            }
        }, cancellationToken);

        // D7: the previous affiliate is told the outcome, not who complained.
        await NotifyAsync(previousUserId, "Attribution đã được điều chỉnh",
            $"Sau khi xem xét khiếu nại, ứng viên {submission.Candidate?.FullName} ở job \"{submission.Job?.Title}\" đã được ghi nhận cho Affiliate khác.",
            dispute.DisputeId, now, cancellationToken);
    }

    private async Task<AdminDisputeDetailDto> ToDetailAsync(Dispute dispute, CancellationToken cancellationToken)
    {
        var submission = dispute.Submission;
        IReadOnlyList<Submission> submissions = submission == null
            ? []
            : await _disputes.GetSubmissionsForCandidateJobAsync(submission.CandidateId, submission.JobId, cancellationToken);
        var attribution = submission == null
            ? null
            : await _disputes.GetAttributionForUpdateAsync(submission.CandidateId, submission.JobId, cancellationToken);

        var userIds = submissions.Select(s => s.SubmittedBy).Append(dispute.RaisedBy).ToList();
        if (attribution != null)
        {
            userIds.Add(attribution.Affiliate.UserId);
        }

        var names = await _disputes.GetAffiliateNamesByUserIdsAsync(userIds, cancellationToken);
        return new AdminDisputeDetailDto(
            dispute.DisputeId, dispute.DisputeType, dispute.Status, dispute.Description, dispute.Evidence,
            dispute.RaisedBy, names.GetValueOrDefault(dispute.RaisedBy), dispute.CreatedAt,
            submission?.JobId, submission?.Job?.Title, submission?.CandidateId, submission?.Candidate?.FullName,
            submission?.Candidate?.NormalizedEmail, submission?.Candidate?.NormalizedPhone,
            submissions.Select(s => new DisputeSubmissionDto(
                s.SubmissionId, s.SubmittedBy, names.GetValueOrDefault(s.SubmittedBy), s.Source, s.Status, s.SubmittedAt,
                s.Consent?.Status, s.Consent?.RespondedAt, s.SubmissionId == dispute.SubmissionId)).ToList(),
            attribution == null
                ? null
                : new DisputeAttributionDto(
                    attribution.AttributionId, attribution.Affiliate.UserId, names.GetValueOrDefault(attribution.Affiliate.UserId),
                    attribution.WinningSubmissionId, attribution.AttributionRule, attribution.EstablishedAt,
                    attribution.Commissions.Select(c => c.Status).ToList(), attribution.Application?.Placement?.ConfirmedAt),
            dispute.CandidateDuplicateCaseId,
            dispute.ResolvedBy, dispute.Resolution, dispute.ResolvedAt,
            dispute.ConcurrencyToken);
    }

    private Task NotifyAsync(Guid userId, string title, string message, Guid disputeId, DateTime now, CancellationToken cancellationToken) =>
        _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId,
            NotificationType = "DISPUTE",
            Title = title,
            Message = message,
            RelatedEntityType = "DISPUTE",
            RelatedEntityId = disputeId,
            Metadata = JsonSerializer.Serialize(new { disputeId, actionRoute = "/affiliate/disputes" }, Json),
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);

    private static MyDisputeDto ToMine(Dispute d, Submission? s) => new(
        d.DisputeId, d.DisputeType, d.Status, d.SubmissionId, s?.Job?.Title, s?.Candidate?.FullName,
        d.Description, d.Resolution, d.CreatedAt, d.ResolvedAt);

    private static string RequireText(string? value, string label)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text) || text.Length > MaxTextLength)
        {
            throw new BadRequestException($"{label} là bắt buộc và tối đa {MaxTextLength} ký tự.");
        }

        return text;
    }

    private static bool IsLink(string value) =>
        value.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || value.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

    private static void ValidateEvidence(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !IsLink(value)) return;
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(uri.Host))
        {
            throw new BadRequestException("Đường dẫn bằng chứng phải là URL HTTPS hợp lệ.");
        }
    }

    private static string? Upper(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}
