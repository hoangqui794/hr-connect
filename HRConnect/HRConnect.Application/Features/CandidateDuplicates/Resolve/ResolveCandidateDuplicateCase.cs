using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.CandidateDuplicates.Common;
using HRConnect.Domain.Entities;
using MediatR;

namespace HRConnect.Application.Features.CandidateDuplicates.Resolve;

public sealed record ResolveCandidateDuplicateCaseCommand(
    Guid DuplicateCaseId,
    Guid AdminUserId,
    string Decision,
    string Reason,
    Guid ConcurrencyToken,
    string IdempotencyKey) : IRequest<ResolveCandidateDuplicateCaseResponse>;

public sealed record ResolveCandidateDuplicateCaseResponse(
    Guid DuplicateCaseId,
    string Status,
    string? Resolution,
    Guid? CanonicalCandidateId,
    Guid? SourceCandidateId,
    IReadOnlyList<Guid> PendingFinalizationSubmissionIds,
    Guid ConcurrencyToken,
    bool IdempotentReplay);

public sealed class ResolveCandidateDuplicateCaseCommandValidator
    : AbstractValidator<ResolveCandidateDuplicateCaseCommand>
{
    private static readonly string[] Decisions = ["MERGE", "DISMISS", "NEED_MORE_EVIDENCE"];

    public ResolveCandidateDuplicateCaseCommandValidator()
    {
        RuleFor(x => x.DuplicateCaseId).NotEmpty();
        RuleFor(x => x.AdminUserId).NotEmpty();
        RuleFor(x => x.Decision)
            .Must(value => !string.IsNullOrWhiteSpace(value) && Decisions.Contains(value.Trim().ToUpperInvariant()))
            .WithMessage("decision chỉ nhận MERGE, DISMISS hoặc NEED_MORE_EVIDENCE.");
        RuleFor(x => x.Reason).NotEmpty().MinimumLength(10).MaximumLength(1000);
        RuleFor(x => x.ConcurrencyToken).NotEmpty();
        RuleFor(x => x.IdempotencyKey).NotEmpty().MaximumLength(160);
    }
}

public sealed class ResolveCandidateDuplicateCaseCommandHandler
    : IRequestHandler<ResolveCandidateDuplicateCaseCommand, ResolveCandidateDuplicateCaseResponse>
{
    private readonly ICandidateDuplicateRepository _duplicates;
    private readonly ICandidateRepository _candidates;
    private readonly ISubmissionRepository _submissions;
    private readonly IApplicationRepository _applications;
    private readonly IAttributionRepository _attributions;
    private readonly INotificationRepository _notifications;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public ResolveCandidateDuplicateCaseCommandHandler(
        ICandidateDuplicateRepository duplicates,
        ICandidateRepository candidates,
        ISubmissionRepository submissions,
        IApplicationRepository applications,
        IAttributionRepository attributions,
        INotificationRepository notifications,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _duplicates = duplicates;
        _candidates = candidates;
        _submissions = submissions;
        _applications = applications;
        _attributions = attributions;
        _notifications = notifications;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<ResolveCandidateDuplicateCaseResponse> Handle(
        ResolveCandidateDuplicateCaseCommand request,
        CancellationToken cancellationToken)
    {
        var decision = request.Decision.Trim().ToUpperInvariant();
        var idempotencyKey = request.IdempotencyKey.Trim();
        var transactionCompleted = false;
        try
        {
            await _unitOfWork.BeginTransactionAsync(cancellationToken);
            var duplicateCase = await _duplicates.GetByIdForUpdateAsync(
                request.DuplicateCaseId,
                cancellationToken) ?? throw new NotFoundException("Không tìm thấy hồ sơ đối chiếu Candidate.");

            if (string.Equals(duplicateCase.ResolutionIdempotencyKey, idempotencyKey, StringComparison.Ordinal))
            {
                await _unitOfWork.CommitTransactionAsync(cancellationToken);
                transactionCompleted = true;
                return CreateResponse(duplicateCase, null, Array.Empty<Guid>(), true);
            }

            if (duplicateCase.Status is "MERGED" or "DISMISSED")
                throw new ConflictException("Hồ sơ đối chiếu đã được xử lý bởi yêu cầu khác.", "DUPLICATE_CASE_CLOSED");
            if (duplicateCase.ConcurrencyToken != request.ConcurrencyToken)
                throw new ConflictException("Dữ liệu đối chiếu đã thay đổi. Vui lòng tải lại trước khi xử lý.", "STALE_DUPLICATE_CASE");

            var now = DateTime.UtcNow;
            Guid? sourceCandidateId = null;
            var pendingFinalization = new List<Guid>();

            if (decision == "NEED_MORE_EVIDENCE")
            {
                ApplyResolutionMetadata(duplicateCase, request, idempotencyKey, now);
                duplicateCase.Status = "UNDER_REVIEW";
                duplicateCase.Resolution = "NO_ACTION";
            }
            else if (decision == "DISMISS")
            {
                ApplyResolutionMetadata(duplicateCase, request, idempotencyKey, now);
                duplicateCase.Status = "DISMISSED";
                duplicateCase.Resolution = "NOT_DUPLICATE";
                var related = await _duplicates.GetRelatedSubmissionsForUpdateAsync(
                    duplicateCase.CandidateAId,
                    duplicateCase.CandidateBId,
                    cancellationToken);
                pendingFinalization.AddRange(related
                    .Where(item => item.Status == "PENDING_IDENTITY_REVIEW" &&
                                   (!duplicateCase.JobId.HasValue || item.JobId == duplicateCase.JobId.Value))
                    .Select(item => item.SubmissionId));
            }
            else
            {
                var lockedCandidates = await _duplicates.GetCandidatesForUpdateAsync(
                    duplicateCase.CandidateAId,
                    duplicateCase.CandidateBId,
                    cancellationToken);
                if (lockedCandidates.Count != 2 || lockedCandidates.Any(item =>
                        item.Status != "ACTIVE" || item.MergedIntoCandidateId.HasValue))
                    throw new ConflictException("Một hồ sơ Candidate đã bị khóa hoặc hợp nhất trước đó.", "CANDIDATE_IDENTITY_CHANGED");

                var related = await _duplicates.GetRelatedSubmissionsForUpdateAsync(
                    duplicateCase.CandidateAId,
                    duplicateCase.CandidateBId,
                    cancellationToken);
                var applications = await _duplicates.GetCandidateApplicationsForUpdateAsync(
                    duplicateCase.CandidateAId,
                    duplicateCase.CandidateBId,
                    cancellationToken);

                if (CandidateMergePolicy.HasCompletedPayout(applications))
                {
                    ApplyResolutionMetadata(duplicateCase, request, idempotencyKey, now);
                    duplicateCase.Status = "BLOCKED_FINANCE";
                    duplicateCase.Resolution = "FINANCE_BLOCKED";
                    await AddAuditAsync(duplicateCase, request.AdminUserId, null, "BLOCKED_FINANCE", now, cancellationToken);
                    await _unitOfWork.CommitTransactionAsync(cancellationToken);
                    transactionCompleted = true;
                    throw new ConflictException(
                        "Không thể hợp nhất vì có hoa hồng đã được chi trả. Finance cần điều chỉnh trước.",
                        "CANDIDATE_MERGE_PAID_COMMISSION");
                }

                var candidateA = lockedCandidates.Single(item => item.CandidateId == duplicateCase.CandidateAId);
                var candidateB = lockedCandidates.Single(item => item.CandidateId == duplicateCase.CandidateBId);
                var (canonical, source, _) = CandidateMergePolicy.RecommendCanonical(
                    candidateA, candidateB, related, applications);
                sourceCandidateId = source.CandidateId;

                source.Status = "ARCHIVED";
                source.MergedIntoCandidateId = canonical.CandidateId;
                source.MergeConcurrencyToken = Guid.NewGuid();
                source.UpdatedAt = now;
                canonical.MergeConcurrencyToken = Guid.NewGuid();
                canonical.UpdatedAt = now;
                _candidates.Update(source);
                _candidates.Update(canonical);

                foreach (var jobGroup in related.GroupBy(item => item.JobId))
                {
                    var winner = CandidateMergePolicy.SelectEarliestConfirmedWinner(jobGroup);
                    if (winner == null) continue;

                    foreach (var loser in jobGroup.Where(item =>
                                 item.SubmissionId != winner.SubmissionId &&
                                 item.Status is "ACCEPTED" or "PENDING_IDENTITY_REVIEW"))
                    {
                        loser.Status = "BLOCKED_DUPLICATE";
                        loser.DuplicateOfSubmissionId = winner.SubmissionId;
                        loser.UpdatedAt = now;
                        _submissions.Update(loser);
                        foreach (var application in loser.Applications.Where(item => item.Status != "CLOSED"))
                        {
                            application.Status = "CLOSED";
                            application.CurrentStage = "CLOSED";
                            application.StatusReasonCode = "CANDIDATE_IDENTITY_MERGED_DUPLICATE";
                            application.StatusReason = "Đơn trùng được đóng sau khi hợp nhất danh tính Candidate.";
                            application.UpdatedAt = now;
                            application.ConcurrencyToken = Guid.NewGuid();
                            _applications.Update(application);
                        }
                        if (loser.Attribution is { Status: "ACTIVE" } attribution)
                        {
                            attribution.Status = "SUPERSEDED";
                            attribution.UpdatedAt = now;
                            attribution.ConcurrencyToken = Guid.NewGuid();
                            _attributions.Update(attribution);
                        }
                    }

                    if (winner.Status == "PENDING_IDENTITY_REVIEW")
                        pendingFinalization.Add(winner.SubmissionId);
                }

                ApplyResolutionMetadata(duplicateCase, request, idempotencyKey, now);
                duplicateCase.Status = "MERGED";
                duplicateCase.Resolution = "MERGED";
                duplicateCase.CanonicalCandidateId = canonical.CandidateId;
                await NotifyCandidateAsync(canonical.UserId, duplicateCase.DuplicateCaseId, now, cancellationToken);
                await NotifyCandidateAsync(source.UserId, duplicateCase.DuplicateCaseId, now, cancellationToken);
            }

            await AddAuditAsync(
                duplicateCase,
                request.AdminUserId,
                sourceCandidateId,
                duplicateCase.Status,
                now,
                cancellationToken);
            await _unitOfWork.CommitTransactionAsync(cancellationToken);
            transactionCompleted = true;
            return CreateResponse(duplicateCase, sourceCandidateId, pendingFinalization, false);
        }
        catch
        {
            if (!transactionCompleted)
                await _unitOfWork.RollbackTransactionAsync(cancellationToken);
            throw;
        }
    }

    private static void ApplyResolutionMetadata(
        CandidateDuplicateCase duplicateCase,
        ResolveCandidateDuplicateCaseCommand request,
        string idempotencyKey,
        DateTime now)
    {
        duplicateCase.ResolutionReason = request.Reason.Trim();
        duplicateCase.ReviewedBy = request.AdminUserId;
        duplicateCase.ReviewedAt = now;
        duplicateCase.ResolutionIdempotencyKey = idempotencyKey;
        duplicateCase.ConcurrencyToken = Guid.NewGuid();
        duplicateCase.UpdatedAt = now;
    }

    private async Task AddAuditAsync(
        CandidateDuplicateCase duplicateCase,
        Guid adminUserId,
        Guid? sourceCandidateId,
        string outcome,
        DateTime now,
        CancellationToken cancellationToken) =>
        await _audit.AddAsync(new AuditEntry
        {
            Action = duplicateCase.Status == "MERGED"
                ? AuditActions.CandidateIdentityMerged
                : AuditActions.CandidateDuplicateCaseResolved,
            EntityType = "CANDIDATE_DUPLICATE_CASE",
            EntityId = duplicateCase.DuplicateCaseId,
            ActorUserId = adminUserId,
            CorrelationId = duplicateCase.DuplicateCaseId,
            OldValues = new { status = "ACTIVE_REVIEW" },
            NewValues = new
            {
                status = outcome,
                duplicateCase.Resolution,
                duplicateCase.CanonicalCandidateId,
                sourceCandidateId,
                resolvedAt = now
            }
        }, cancellationToken);

    private async Task NotifyCandidateAsync(
        Guid? userId,
        Guid duplicateCaseId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (!userId.HasValue) return;
        await _notifications.AddAsync(new Notification
        {
            NotificationId = Guid.NewGuid(),
            UserId = userId.Value,
            NotificationType = "CANDIDATE_IDENTITY",
            Title = "Hồ sơ danh tính đã được đối chiếu",
            Message = "Hệ thống đã hoàn tất đối chiếu các hồ sơ Candidate của bạn. Lịch sử ứng tuyển vẫn được giữ nguyên.",
            RelatedEntityType = "CANDIDATE_DUPLICATE_CASE",
            RelatedEntityId = duplicateCaseId,
            Metadata = "{}",
            IsRead = false,
            CreatedAt = now
        }, cancellationToken);
    }

    private static ResolveCandidateDuplicateCaseResponse CreateResponse(
        CandidateDuplicateCase duplicateCase,
        Guid? sourceCandidateId,
        IReadOnlyList<Guid> pendingFinalization,
        bool idempotentReplay) => new(
        duplicateCase.DuplicateCaseId,
        duplicateCase.Status,
        duplicateCase.Resolution,
        duplicateCase.CanonicalCandidateId,
        sourceCandidateId,
        pendingFinalization,
        duplicateCase.ConcurrencyToken,
        idempotentReplay);
}
