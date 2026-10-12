using System.Linq;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;

public class GetCandidateCvsQueryHandler : IRequestHandler<GetCandidateCvsQuery, GetCandidateCvsResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly ILogger<GetCandidateCvsQueryHandler> _logger;

    public GetCandidateCvsQueryHandler(
        ICandidateRepository candidateRepository,
        ICandidateCvRepository candidateCvRepository,
        ILogger<GetCandidateCvsQueryHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _candidateCvRepository = candidateCvRepository;
        _logger = logger;
    }

    public async Task<GetCandidateCvsResponse> Handle(GetCandidateCvsQuery request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng viên cho UserId: {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin ứng viên tương ứng với tài khoản.");
        }

        var cvs = await _candidateCvRepository.GetPersonalCvUsageAsync(candidate.CandidateId, cancellationToken);

        var items = cvs.Select(record => new CandidateCvItemResponse
        {
            CvId = record.Cv.CvId,
            Title = record.Cv.Title,
            FileName = record.Cv.FileName ?? $"{record.Cv.CvId}.pdf",
            MimeType = record.Cv.MimeType ?? "application/pdf",
            FileSizeBytes = record.Cv.FileSizeBytes,
            IsPrimary = record.Cv.IsPrimary,
            Status = record.Cv.Status,
            CreatedAt = record.Cv.CreatedAt,
            UpdatedAt = record.Cv.UpdatedAt,
            SubmissionUsageCount = record.SubmissionUsageCount,
            ApplicationUsageCount = record.ApplicationUsageCount,
            IsReferenced = record.SubmissionUsageCount > 0,
            DeleteBehavior = record.SubmissionUsageCount > 0 ? "ARCHIVE_HISTORY" : "HARD_DELETE"
        }).ToList();

        return new GetCandidateCvsResponse
        {
            Success = true,
            Message = "Lấy danh sách CV thành công.",
            Data = items
        };
    }
}
