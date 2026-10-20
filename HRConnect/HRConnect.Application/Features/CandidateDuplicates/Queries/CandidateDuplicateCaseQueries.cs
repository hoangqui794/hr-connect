using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CandidateDuplicates.Queries;

public sealed record GetCandidateDuplicateCasesQuery(
    string? Status,
    string? RiskLevel,
    Guid? JobId,
    Guid? CompanyId,
    DateTime? CreatedFrom,
    DateTime? CreatedTo,
    string? Search,
    int Page = 1,
    int PageSize = 20) : IRequest<CandidateDuplicateCaseListResponse>;

public sealed record GetCandidateDuplicateCaseDetailQuery(Guid DuplicateCaseId)
    : IRequest<CandidateDuplicateCaseDetailResponse>;

public sealed class GetCandidateDuplicateCasesQueryValidator : AbstractValidator<GetCandidateDuplicateCasesQuery>
{
    private static readonly string[] Statuses =
        ["OPEN", "AWAITING_CANDIDATE", "UNDER_REVIEW", "MERGED", "DISMISSED", "BLOCKED_FINANCE"];
    private static readonly string[] RiskLevels = ["REVIEW", "HIGH"];

    public GetCandidateDuplicateCasesQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.Status)
            .Must(value => value == null || Statuses.Contains(value.Trim().ToUpperInvariant()))
            .WithMessage("status không hợp lệ.");
        RuleFor(x => x.RiskLevel)
            .Must(value => value == null || RiskLevels.Contains(value.Trim().ToUpperInvariant()))
            .WithMessage("riskLevel chỉ nhận REVIEW hoặc HIGH.");
        RuleFor(x => x.CreatedTo)
            .GreaterThanOrEqualTo(x => x.CreatedFrom)
            .When(x => x.CreatedFrom.HasValue && x.CreatedTo.HasValue)
            .WithMessage("createdTo phải lớn hơn hoặc bằng createdFrom.");
        RuleFor(x => x.Search).MaximumLength(200);
    }
}

public sealed record CandidateDuplicateCaseListResponse(
    IReadOnlyList<CandidateDuplicateCaseListItem> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public sealed record CandidateDuplicateCaseListItem(
    Guid DuplicateCaseId,
    string Status,
    string RiskLevel,
    CandidateDuplicatePartyDto CandidateA,
    CandidateDuplicatePartyDto CandidateB,
    Guid? JobId,
    string? JobTitle,
    Guid? CompanyId,
    string? CompanyName,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid ConcurrencyToken);

public sealed record CandidateDuplicateCaseDetailResponse(
    Guid DuplicateCaseId,
    string Status,
    string RiskLevel,
    string? Resolution,
    string? ResolutionReason,
    CandidateDuplicatePartyDto CandidateA,
    CandidateDuplicatePartyDto CandidateB,
    Guid? CanonicalCandidateId,
    CandidateDuplicateJobDto? Job,
    IReadOnlyList<CandidateDuplicateSignalDto> Signals,
    IReadOnlyList<CandidateDuplicateSubmissionDto> Submissions,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid ConcurrencyToken);

public sealed record CandidateDuplicatePartyDto(
    Guid CandidateId,
    string FullName,
    string? MaskedEmail,
    string? MaskedPhone,
    bool HasAccount,
    string Status,
    DateTime CreatedAt);

public sealed record CandidateDuplicateJobDto(
    Guid JobId,
    string Title,
    Guid CompanyId,
    string CompanyName);

public sealed record CandidateDuplicateSignalDto(
    string ReasonCode,
    string DetectorVersion,
    decimal Score,
    string Evidence,
    DateTime CreatedAt);

public sealed record CandidateDuplicateSubmissionDto(
    Guid SubmissionId,
    Guid CandidateId,
    string Status,
    string Source,
    DateTime SubmittedAt,
    string? ConsentStatus,
    DateTime? ConsentRespondedAt,
    Guid? ApplicationId,
    Guid? AttributionId,
    Guid? AffiliateId,
    string? AttributionStatus,
    IReadOnlyList<string> CommissionStatuses);

public sealed class GetCandidateDuplicateCasesQueryHandler
    : IRequestHandler<GetCandidateDuplicateCasesQuery, CandidateDuplicateCaseListResponse>
{
    private readonly ICandidateDuplicateRepository _repository;

    public GetCandidateDuplicateCasesQueryHandler(ICandidateDuplicateRepository repository) =>
        _repository = repository;

    public async Task<CandidateDuplicateCaseListResponse> Handle(
        GetCandidateDuplicateCasesQuery request,
        CancellationToken cancellationToken)
    {
        var status = Normalize(request.Status);
        var riskLevel = Normalize(request.RiskLevel);
        var (items, totalCount) = await _repository.GetReviewPageAsync(
            status,
            riskLevel,
            request.JobId,
            request.CompanyId,
            request.CreatedFrom,
            request.CreatedTo,
            request.Search,
            (request.Page - 1) * request.PageSize,
            request.PageSize,
            cancellationToken);

        return new CandidateDuplicateCaseListResponse(
            items.Select(item => new CandidateDuplicateCaseListItem(
                item.DuplicateCaseId,
                item.Status,
                item.RiskLevel,
                MapParty(item.CandidateA),
                MapParty(item.CandidateB),
                item.JobId,
                item.Job?.Title,
                item.Job?.CompanyId,
                item.Job?.Company.CompanyName,
                item.CreatedAt,
                item.UpdatedAt,
                item.ConcurrencyToken)).ToArray(),
            request.Page,
            request.PageSize,
            totalCount,
            totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)request.PageSize));
    }

    internal static CandidateDuplicatePartyDto MapParty(HRConnect.Domain.Entities.Candidate candidate) => new(
        candidate.CandidateId,
        candidate.FullName,
        MaskEmail(candidate.Email),
        MaskPhone(candidate.Phone),
        candidate.UserId.HasValue,
        candidate.Status,
        candidate.CreatedAt);

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();

    private static string? MaskEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var at = value.IndexOf('@');
        if (at <= 0) return "***";
        var local = value[..at];
        var visible = local[..Math.Min(2, local.Length)];
        return $"{visible}***{value[at..]}";
    }

    private static string? MaskPhone(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var digits = new string(value.Where(char.IsDigit).ToArray());
        if (digits.Length <= 4) return "****";
        return $"***{digits[^4..]}";
    }
}

public sealed class GetCandidateDuplicateCaseDetailQueryHandler
    : IRequestHandler<GetCandidateDuplicateCaseDetailQuery, CandidateDuplicateCaseDetailResponse>
{
    private readonly ICandidateDuplicateRepository _repository;

    public GetCandidateDuplicateCaseDetailQueryHandler(ICandidateDuplicateRepository repository) =>
        _repository = repository;

    public async Task<CandidateDuplicateCaseDetailResponse> Handle(
        GetCandidateDuplicateCaseDetailQuery request,
        CancellationToken cancellationToken)
    {
        var duplicateCase = await _repository.GetByIdForReviewAsync(
            request.DuplicateCaseId,
            cancellationToken) ?? throw new NotFoundException("Không tìm thấy hồ sơ đối chiếu Candidate.");
        var submissions = await _repository.GetRelatedSubmissionsAsync(
            duplicateCase.CandidateAId,
            duplicateCase.CandidateBId,
            duplicateCase.JobId,
            cancellationToken);

        return new CandidateDuplicateCaseDetailResponse(
            duplicateCase.DuplicateCaseId,
            duplicateCase.Status,
            duplicateCase.RiskLevel,
            duplicateCase.Resolution,
            duplicateCase.ResolutionReason,
            GetCandidateDuplicateCasesQueryHandler.MapParty(duplicateCase.CandidateA),
            GetCandidateDuplicateCasesQueryHandler.MapParty(duplicateCase.CandidateB),
            duplicateCase.CanonicalCandidateId,
            duplicateCase.Job == null
                ? null
                : new CandidateDuplicateJobDto(
                    duplicateCase.Job.JobId,
                    duplicateCase.Job.Title,
                    duplicateCase.Job.CompanyId,
                    duplicateCase.Job.Company.CompanyName),
            duplicateCase.Signals
                .OrderByDescending(signal => signal.Score)
                .ThenBy(signal => signal.CreatedAt)
                .Select(signal => new CandidateDuplicateSignalDto(
                    signal.ReasonCode,
                    signal.DetectorVersion,
                    signal.Score,
                    signal.Evidence,
                    signal.CreatedAt))
                .ToArray(),
            submissions.Select(submission => new CandidateDuplicateSubmissionDto(
                submission.SubmissionId,
                submission.CandidateId,
                submission.Status,
                submission.Source,
                submission.SubmittedAt,
                submission.Consent?.Status,
                submission.Consent?.RespondedAt,
                submission.Applications.FirstOrDefault()?.ApplicationId,
                submission.Attribution?.AttributionId,
                submission.Attribution?.AffiliateId,
                submission.Attribution?.Status,
                submission.Attribution?.Commissions.Select(commission => commission.Status).Distinct().ToArray()
                    ?? Array.Empty<string>())).ToArray(),
            duplicateCase.CreatedAt,
            duplicateCase.UpdatedAt,
            duplicateCase.ConcurrencyToken);
    }
}
