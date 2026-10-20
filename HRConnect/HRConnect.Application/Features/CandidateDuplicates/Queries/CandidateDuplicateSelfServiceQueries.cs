using FluentValidation;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.CandidateDuplicates.Queries;

public sealed record GetMyCandidateDuplicateCasesQuery(
    Guid UserId,
    string? Status,
    int Page = 1,
    int PageSize = 20) : IRequest<MyCandidateDuplicateCaseListResponse>;

public sealed record GetMyCandidateDuplicateCaseDetailQuery(
    Guid UserId,
    Guid DuplicateCaseId) : IRequest<MyCandidateDuplicateCaseDetailResponse>;

public sealed class GetMyCandidateDuplicateCasesQueryValidator
    : AbstractValidator<GetMyCandidateDuplicateCasesQuery>
{
    private static readonly string[] Statuses =
        ["OPEN", "AWAITING_CANDIDATE", "UNDER_REVIEW", "MERGED", "DISMISSED", "BLOCKED_FINANCE"];

    public GetMyCandidateDuplicateCasesQueryValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.Status)
            .Must(value => value == null || Statuses.Contains(value.Trim().ToUpperInvariant()))
            .WithMessage("status không hợp lệ.");
    }
}

public sealed record MyCandidateDuplicateCaseListResponse(
    IReadOnlyList<MyCandidateDuplicateCaseListItem> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public sealed record MyCandidateDuplicateCaseListItem(
    Guid DuplicateCaseId,
    string Status,
    string RiskLevel,
    string Title,
    string Guidance,
    bool ActionRequired,
    CandidateDuplicateJobDto? Job,
    IReadOnlyList<string> EvidenceTypes,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed record MyCandidateDuplicateCaseDetailResponse(
    Guid DuplicateCaseId,
    string Status,
    string RiskLevel,
    string Title,
    string Guidance,
    bool ActionRequired,
    CandidateDuplicateJobDto? Job,
    IReadOnlyList<string> EvidenceTypes,
    string? Resolution,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public sealed class GetMyCandidateDuplicateCasesQueryHandler
    : IRequestHandler<GetMyCandidateDuplicateCasesQuery, MyCandidateDuplicateCaseListResponse>
{
    private readonly ICandidateDuplicateRepository _repository;

    public GetMyCandidateDuplicateCasesQueryHandler(ICandidateDuplicateRepository repository) =>
        _repository = repository;

    public async Task<MyCandidateDuplicateCaseListResponse> Handle(
        GetMyCandidateDuplicateCasesQuery request,
        CancellationToken cancellationToken)
    {
        var status = Normalize(request.Status);
        var (items, totalCount) = await _repository.GetCandidatePageAsync(
            request.UserId,
            status,
            (request.Page - 1) * request.PageSize,
            request.PageSize,
            cancellationToken);

        return new MyCandidateDuplicateCaseListResponse(
            items.Select(MapListItem).ToArray(),
            request.Page,
            request.PageSize,
            totalCount,
            totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)request.PageSize));
    }

    internal static MyCandidateDuplicateCaseListItem MapListItem(
        HRConnect.Domain.Entities.CandidateDuplicateCase duplicateCase)
    {
        var (title, guidance, actionRequired) = Describe(duplicateCase.Status);
        return new MyCandidateDuplicateCaseListItem(
            duplicateCase.DuplicateCaseId,
            duplicateCase.Status,
            duplicateCase.RiskLevel,
            title,
            guidance,
            actionRequired,
            MapJob(duplicateCase),
            MapEvidenceTypes(duplicateCase),
            duplicateCase.CreatedAt,
            duplicateCase.UpdatedAt);
    }

    internal static CandidateDuplicateJobDto? MapJob(
        HRConnect.Domain.Entities.CandidateDuplicateCase duplicateCase) =>
        duplicateCase.Job == null
            ? null
            : new CandidateDuplicateJobDto(
                duplicateCase.Job.JobId,
                duplicateCase.Job.Title,
                duplicateCase.Job.CompanyId,
                duplicateCase.Job.Company.CompanyName);

    internal static IReadOnlyList<string> MapEvidenceTypes(
        HRConnect.Domain.Entities.CandidateDuplicateCase duplicateCase) =>
        duplicateCase.Signals
            .Select(signal => signal.ReasonCode switch
            {
                "VERIFIED_EMAIL_OWNERSHIP" => "VERIFIED_EMAIL",
                "EXACT_CV_AND_NORMALIZED_NAME" => "MATCHING_CV_AND_NAME",
                _ => "OTHER_REVIEW_SIGNAL"
            })
            .Distinct(StringComparer.Ordinal)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();

    internal static (string Title, string Guidance, bool ActionRequired) Describe(string status) =>
        status switch
        {
            "AWAITING_CANDIDATE" => (
                "Cần xác minh hồ sơ của bạn",
                "Hệ thống phát hiện một hồ sơ có thể thuộc về bạn. Hãy xác minh email cũ để tiếp tục.",
                true),
            "UNDER_REVIEW" => (
                "Hồ sơ đang được đối chiếu",
                "Bằng chứng của bạn đã được ghi nhận. Ban quản trị đang kiểm tra và sẽ thông báo kết quả.",
                false),
            "BLOCKED_FINANCE" => (
                "Hồ sơ cần kiểm tra quyền lợi liên quan",
                "Ban quản trị đang xử lý quyền lợi phát sinh trước khi hoàn tất đối chiếu.",
                false),
            "MERGED" => (
                "Hồ sơ đã được hợp nhất",
                "Dữ liệu hợp lệ đã được giữ lại trong hồ sơ chính của bạn.",
                false),
            "DISMISSED" => (
                "Hai hồ sơ không trùng nhau",
                "Việc đối chiếu đã kết thúc và hồ sơ của bạn không bị thay đổi.",
                false),
            _ => (
                "Hồ sơ đang chờ đối chiếu",
                "Ban quản trị sẽ kiểm tra và thông báo khi có kết quả mới.",
                false)
        };

    private static string? Normalize(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToUpperInvariant();
}

public sealed class GetMyCandidateDuplicateCaseDetailQueryHandler
    : IRequestHandler<GetMyCandidateDuplicateCaseDetailQuery, MyCandidateDuplicateCaseDetailResponse>
{
    private readonly ICandidateDuplicateRepository _repository;

    public GetMyCandidateDuplicateCaseDetailQueryHandler(ICandidateDuplicateRepository repository) =>
        _repository = repository;

    public async Task<MyCandidateDuplicateCaseDetailResponse> Handle(
        GetMyCandidateDuplicateCaseDetailQuery request,
        CancellationToken cancellationToken)
    {
        var duplicateCase = await _repository.GetByIdForCandidateAsync(
            request.DuplicateCaseId,
            request.UserId,
            cancellationToken) ?? throw new NotFoundException("Không tìm thấy hồ sơ đối chiếu của bạn.");
        var (title, guidance, actionRequired) =
            GetMyCandidateDuplicateCasesQueryHandler.Describe(duplicateCase.Status);

        return new MyCandidateDuplicateCaseDetailResponse(
            duplicateCase.DuplicateCaseId,
            duplicateCase.Status,
            duplicateCase.RiskLevel,
            title,
            guidance,
            actionRequired,
            GetMyCandidateDuplicateCasesQueryHandler.MapJob(duplicateCase),
            GetMyCandidateDuplicateCasesQueryHandler.MapEvidenceTypes(duplicateCase),
            duplicateCase.Resolution,
            duplicateCase.CreatedAt,
            duplicateCase.UpdatedAt);
    }
}
