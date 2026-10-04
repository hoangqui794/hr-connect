using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Queries.GetCvDownloadUrl;

public class GetCvDownloadUrlQueryHandler : IRequestHandler<GetCvDownloadUrlQuery, GetCvDownloadUrlResponse>
{
    private readonly ICvStorageService _cvStorageService;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly ICandidateRepository _candidateRepository;
    private readonly ILogger<GetCvDownloadUrlQueryHandler> _logger;
    private readonly IAuditLogService _audit;
    private readonly IUnitOfWork _unitOfWork;

    public GetCvDownloadUrlQueryHandler(
        ICvStorageService cvStorageService,
        ICandidateCvRepository candidateCvRepository,
        ICandidateRepository candidateRepository,
        ILogger<GetCvDownloadUrlQueryHandler> logger,
        IAuditLogService audit,
        IUnitOfWork unitOfWork)
    {
        _cvStorageService = cvStorageService;
        _candidateCvRepository = candidateCvRepository;
        _candidateRepository = candidateRepository;
        _logger = logger;
        _audit = audit;
        _unitOfWork = unitOfWork;
    }

    public async Task<GetCvDownloadUrlResponse> Handle(GetCvDownloadUrlQuery request, CancellationToken cancellationToken)
    {
        var cv = await _candidateCvRepository.GetByIdAsync(request.CvId, cancellationToken);
        if (cv == null)
        {
            _logger.LogWarning("Không tìm thấy CV với CvId: {CvId}", request.CvId);
            throw new NotFoundException($"Không tìm thấy CV với mã {request.CvId}.");
        }

        // Nếu có UserId, kiểm tra quyền sở hữu của ứng viên
        if (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
        {
            var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId.Value, cancellationToken);
            if (candidate == null || candidate.CandidateId != cv.CandidateId)
            {
                _logger.LogWarning("UserId {UserId} cố gắng truy cập CV {CvId} không thuộc sở hữu.", request.UserId, request.CvId);
                throw new ForbiddenException("Bạn không có quyền truy cập CV này.");
            }
        }

        if (request.ExpiryMinutes.HasValue && request.ExpiryMinutes.Value <= 0)
        {
            throw new BadRequestException("Thời hạn đường dẫn tải CV phải là số phút dương.");
        }

        TimeSpan? expiry = request.ExpiryMinutes.HasValue
            ? TimeSpan.FromMinutes(request.ExpiryMinutes.Value)
            : null;

        var result = await _cvStorageService.GetCvDownloadUrlAsync(request.CvId, expiry, cancellationToken);

        await _audit.AddAsync(new AuditEntry
        {
            Action = AuditActions.CandidateCvDownloadUrlIssued,
            EntityType = "CANDIDATE_CV",
            EntityId = cv.CvId,
            ActorUserId = request.UserId,
            NewValues = new
            {
                cv.CandidateId,
                result.ExpiresAt,
                requestedExpiryMinutes = request.ExpiryMinutes
            }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new GetCvDownloadUrlResponse
        {
            Success = true,
            Message = "Lấy đường dẫn tải xuống CV thành công.",
            Data = result
        };
    }
}
