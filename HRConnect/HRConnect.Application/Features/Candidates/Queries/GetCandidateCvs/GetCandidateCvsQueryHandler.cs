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

        var cvs = await _candidateCvRepository.GetByCandidateIdAsync(candidate.CandidateId, cancellationToken);

        var items = cvs.Select(cv => new CandidateCvItemResponse
        {
            CvId = cv.CvId,
            Title = cv.Title,
            FileName = cv.FileName ?? $"{cv.CvId}.pdf",
            MimeType = cv.MimeType ?? "application/pdf",
            FileSizeBytes = cv.FileSizeBytes,
            IsPrimary = cv.IsPrimary,
            Status = cv.Status,
            CreatedAt = cv.CreatedAt,
            UpdatedAt = cv.UpdatedAt
        }).ToList();

        return new GetCandidateCvsResponse
        {
            Success = true,
            Message = "Lấy danh sách CV thành công.",
            Data = items
        };
    }
}
