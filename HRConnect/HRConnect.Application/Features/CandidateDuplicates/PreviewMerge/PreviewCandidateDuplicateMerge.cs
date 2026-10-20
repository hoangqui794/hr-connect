using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Features.CandidateDuplicates.Common;
using MediatR;

namespace HRConnect.Application.Features.CandidateDuplicates.PreviewMerge;

public sealed record PreviewCandidateDuplicateMergeQuery(Guid DuplicateCaseId)
    : IRequest<PreviewCandidateDuplicateMergeResponse>;

public sealed record PreviewCandidateDuplicateMergeResponse(
    Guid DuplicateCaseId,
    Guid RecommendedCanonicalCandidateId,
    Guid SourceCandidateId,
    string RecommendationReason,
    bool CanMerge,
    IReadOnlyList<CandidateMergeCollisionDto> Collisions,
    IReadOnlyList<CandidateMergeFinanceBlockerDto> FinanceBlockers,
    Guid ConcurrencyToken);

public sealed record CandidateMergeCollisionDto(
    Guid JobId,
    string JobTitle,
    IReadOnlyList<Guid> CandidateIds,
    IReadOnlyList<Guid> SubmissionIds,
    IReadOnlyList<Guid> ApplicationIds,
    string ResolutionRule);

public sealed record CandidateMergeFinanceBlockerDto(
    Guid ApplicationId,
    Guid AttributionId,
    Guid CommissionId,
    Guid PayoutId,
    string PayoutStatus,
    string ReasonCode);

public sealed class PreviewCandidateDuplicateMergeQueryHandler
    : IRequestHandler<PreviewCandidateDuplicateMergeQuery, PreviewCandidateDuplicateMergeResponse>
{
    private readonly ICandidateDuplicateRepository _repository;

    public PreviewCandidateDuplicateMergeQueryHandler(ICandidateDuplicateRepository repository) =>
        _repository = repository;

    public async Task<PreviewCandidateDuplicateMergeResponse> Handle(
        PreviewCandidateDuplicateMergeQuery request,
        CancellationToken cancellationToken)
    {
        var duplicateCase = await _repository.GetByIdForReviewAsync(
            request.DuplicateCaseId,
            cancellationToken) ?? throw new NotFoundException("Không tìm thấy hồ sơ đối chiếu Candidate.");

        if (duplicateCase.Status is "MERGED" or "DISMISSED")
            throw new ConflictException("Hồ sơ đối chiếu đã kết thúc và không thể xem trước hợp nhất.", "DUPLICATE_CASE_CLOSED");

        var submissions = await _repository.GetRelatedSubmissionsAsync(
            duplicateCase.CandidateAId,
            duplicateCase.CandidateBId,
            null,
            cancellationToken);
        var applications = await _repository.GetCandidateApplicationsAsync(
            duplicateCase.CandidateAId,
            duplicateCase.CandidateBId,
            cancellationToken);

        var (canonical, source, recommendationReason) = CandidateMergePolicy.RecommendCanonical(
            duplicateCase.CandidateA,
            duplicateCase.CandidateB,
            submissions,
            applications);

        var collisions = submissions
            .GroupBy(item => item.JobId)
            .Where(group => group.Select(item => item.CandidateId).Distinct().Count() > 1)
            .Select(group => CreateCollision(
                group.Key,
                group.First().Job?.Title,
                group,
                applications.Where(application => application.JobId == group.Key)))
            .Concat(applications
                .GroupBy(item => item.JobId)
                .Where(group => group.Select(item => item.CandidateId).Distinct().Count() > 1 &&
                                submissions.All(submission => submission.JobId != group.Key ||
                                    submissions.Where(item => item.JobId == group.Key)
                                        .Select(item => item.CandidateId).Distinct().Count() <= 1))
                .Select(group => CreateCollision(
                    group.Key,
                    group.First().Job.Title,
                    submissions.Where(submission => submission.JobId == group.Key),
                    group)))
            .OrderBy(item => item.JobTitle)
            .ThenBy(item => item.JobId)
            .ToArray();

        var financeBlockers = applications
            .Where(application => application.Attribution != null)
            .SelectMany(application => application.Attribution!.Commissions.SelectMany(
                commission => commission.Payouts
                    .Where(payout => payout.Status == "COMPLETED")
                    .Select(payout => new CandidateMergeFinanceBlockerDto(
                        application.ApplicationId,
                        application.Attribution.AttributionId,
                        commission.CommissionId,
                        payout.PayoutId,
                        payout.Status,
                        "PAID_COMMISSION_REQUIRES_FINANCE_ADJUSTMENT"))))
            .OrderBy(item => item.ApplicationId)
            .ThenBy(item => item.CommissionId)
            .ToArray();

        return new PreviewCandidateDuplicateMergeResponse(
            duplicateCase.DuplicateCaseId,
            canonical.CandidateId,
            source.CandidateId,
            recommendationReason,
            financeBlockers.Length == 0,
            collisions,
            financeBlockers,
            duplicateCase.ConcurrencyToken);
    }

    private static CandidateMergeCollisionDto CreateCollision(
        Guid jobId,
        string? jobTitle,
        IEnumerable<HRConnect.Domain.Entities.Submission> submissions,
        IEnumerable<HRConnect.Domain.Entities.Application> applications) => new(
        jobId,
        jobTitle ?? "Công việc không còn hiển thị",
        submissions.Select(item => item.CandidateId)
            .Concat(applications.Select(item => item.CandidateId))
            .Distinct()
            .OrderBy(item => item)
            .ToArray(),
        submissions.Select(item => item.SubmissionId).Distinct().OrderBy(item => item).ToArray(),
        applications.Select(item => item.ApplicationId).Distinct().OrderBy(item => item).ToArray(),
        "EARLIEST_CANDIDATE_CONFIRMED_VALID_SUBMISSION");
}
