using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.CandidateDuplicates.Finalization;
using HRConnect.Application.Features.CandidateDuplicates.Queries;
using MediatR;

namespace HRConnect.Application.Features.CandidateDuplicates.Resolve;

public sealed record DecideMyCandidateDuplicateCaseCommand(
    Guid UserId,
    Guid DuplicateCaseId,
    string Decision = "DISMISS",
    string? Reason = null,
    Guid? ConcurrencyToken = null) : IRequest<DecideMyCandidateDuplicateCaseResponse>;

public sealed record DecideMyCandidateDuplicateCaseResponse(
    bool Success,
    string Message,
    Guid DuplicateCaseId,
    string Status,
    string? Resolution,
    string Title,
    string Guidance,
    bool ActionRequired,
    Guid ConcurrencyToken);

public sealed class DecideMyCandidateDuplicateCaseCommandValidator
    : AbstractValidator<DecideMyCandidateDuplicateCaseCommand>
{
    private static readonly HashSet<string> AllowedDecisions = new(StringComparer.OrdinalIgnoreCase)
    {
        "DISMISS",
        "NOT_ME",
        "NOT_DUPLICATE",
        "REJECT",
        "MERGE",
        "CONFIRM_SAME_PERSON",
        "SAME_PERSON",
        "CONFIRM"
    };

    public DecideMyCandidateDuplicateCaseCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.DuplicateCaseId).NotEmpty();
        RuleFor(x => x.Decision)
            .Must(value => !string.IsNullOrWhiteSpace(value) && AllowedDecisions.Contains(value.Trim()))
            .WithMessage("decision chỉ nhận DISMISS (NOT_ME) hoặc MERGE (CONFIRM_SAME_PERSON).");
        RuleFor(x => x.Reason)
            .MaximumLength(1000)
            .When(x => !string.IsNullOrWhiteSpace(x.Reason));
    }
}

public sealed class DecideMyCandidateDuplicateCaseCommandHandler(
    ICandidateDuplicateRepository duplicates,
    IFinalizeIdentityReviewedSubmissionService finalizer,
    IAuditLogService audit,
    IUnitOfWork unitOfWork)
    : IRequestHandler<DecideMyCandidateDuplicateCaseCommand, DecideMyCandidateDuplicateCaseResponse>
{
    public async Task<DecideMyCandidateDuplicateCaseResponse> Handle(
        DecideMyCandidateDuplicateCaseCommand request,
        CancellationToken cancellationToken)
    {
        var rawDecision = string.IsNullOrWhiteSpace(request.Decision)
            ? "DISMISS"
            : request.Decision.Trim().ToUpperInvariant();
        var isDismiss = rawDecision is "DISMISS" or "NOT_ME" or "NOT_DUPLICATE" or "REJECT";

        var transactionCompleted = false;
        await unitOfWork.BeginTransactionAsync(cancellationToken);
        try
        {
            var duplicateCase = await duplicates.GetByIdForUpdateAsync(
                request.DuplicateCaseId,
                cancellationToken) ?? throw new NotFoundException("Không tìm thấy hồ sơ đối chiếu của bạn.");

            var isOwner =
                duplicateCase.CandidateA?.UserId == request.UserId ||
                duplicateCase.CandidateB?.UserId == request.UserId ||
                duplicateCase.CanonicalCandidate?.UserId == request.UserId;

            if (!isOwner)
                throw new NotFoundException("Không tìm thấy hồ sơ đối chiếu của bạn.");

            if (duplicateCase.Status is "MERGED" or "DISMISSED")
                throw new ConflictException("Hồ sơ đối chiếu này đã được xử lý trước đó.", "DUPLICATE_CASE_CLOSED");

            if (request.ConcurrencyToken.HasValue &&
                request.ConcurrencyToken.Value != Guid.Empty &&
                duplicateCase.ConcurrencyToken != request.ConcurrencyToken.Value)
                throw new ConflictException("Dữ liệu đối chiếu đã thay đổi. Vui lòng tải lại.", "STALE_DUPLICATE_CASE");

            var now = DateTime.UtcNow;
            var previousStatus = duplicateCase.Status;
            var newToken = Guid.NewGuid();

            if (isDismiss)
            {
                var reason = string.IsNullOrWhiteSpace(request.Reason)
                    ? "Ứng viên xác nhận đây không phải hồ sơ của mình."
                    : request.Reason.Trim();

                duplicateCase.Status = "DISMISSED";
                duplicateCase.Resolution = "NOT_DUPLICATE";
                duplicateCase.ResolutionReason = reason;
                duplicateCase.ReviewedBy = request.UserId;
                duplicateCase.ReviewedAt = now;
                duplicateCase.UpdatedAt = now;
                duplicateCase.ConcurrencyToken = newToken;

                var related = await duplicates.GetRelatedSubmissionsForUpdateAsync(
                    duplicateCase.CandidateAId,
                    duplicateCase.CandidateBId,
                    cancellationToken);
                var heldSubmissions = related
                    .Where(item => item.Status == "PENDING_IDENTITY_REVIEW" &&
                                   (!duplicateCase.JobId.HasValue || item.JobId == duplicateCase.JobId.Value))
                    .OrderBy(item => item.Consent?.RespondedAt ?? DateTime.MaxValue)
                    .ThenBy(item => item.SubmittedAt)
                    .ThenBy(item => item.SubmissionId)
                    .ToArray();

                foreach (var heldSubmission in heldSubmissions)
                {
                    await finalizer.FinalizeAsync(
                        heldSubmission,
                        request.UserId,
                        duplicateCase.DuplicateCaseId,
                        now,
                        cancellationToken);
                }

                await audit.AddAsync(new AuditEntry
                {
                    Action = AuditActions.CandidateDuplicateCaseDismissedByCandidate,
                    EntityType = "CANDIDATE_DUPLICATE_CASE",
                    EntityId = duplicateCase.DuplicateCaseId,
                    ActorUserId = request.UserId,
                    OldValues = new { status = previousStatus },
                    NewValues = new
                    {
                        status = duplicateCase.Status,
                        resolution = duplicateCase.Resolution,
                        reason
                    }
                }, cancellationToken);
            }
            else
            {
                var reason = string.IsNullOrWhiteSpace(request.Reason)
                    ? "Ứng viên xác nhận là cùng một người, chờ đối chiếu hợp nhất."
                    : request.Reason.Trim();

                duplicateCase.Status = "UNDER_REVIEW";
                duplicateCase.Resolution = "NO_ACTION";
                duplicateCase.ResolutionReason = reason;
                duplicateCase.UpdatedAt = now;
                duplicateCase.ConcurrencyToken = newToken;

                await audit.AddAsync(new AuditEntry
                {
                    Action = AuditActions.CandidateDuplicateCaseResolved,
                    EntityType = "CANDIDATE_DUPLICATE_CASE",
                    EntityId = duplicateCase.DuplicateCaseId,
                    ActorUserId = request.UserId,
                    OldValues = new { status = previousStatus },
                    NewValues = new
                    {
                        status = duplicateCase.Status,
                        resolution = duplicateCase.Resolution,
                        reason
                    }
                }, cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
            await unitOfWork.CommitTransactionAsync(cancellationToken);
            transactionCompleted = true;

            var (title, guidance, actionRequired) =
                GetMyCandidateDuplicateCasesQueryHandler.Describe(duplicateCase.Status);

            var message = isDismiss
                ? "Đã ghi nhận đây không phải hồ sơ của bạn và đóng yêu cầu đối chiếu."
                : "Đã ghi nhận xác nhận của bạn. Bộ phận hỗ trợ sẽ kiểm tra và hợp nhất hồ sơ.";

            return new DecideMyCandidateDuplicateCaseResponse(
                true,
                message,
                duplicateCase.DuplicateCaseId,
                duplicateCase.Status,
                duplicateCase.Resolution,
                title,
                guidance,
                actionRequired,
                newToken);
        }
        finally
        {
            if (!transactionCompleted)
                await unitOfWork.RollbackTransactionAsync(cancellationToken);
        }
    }
}
