using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Internal.Queries.GetInternalCvDownloadUrl;

public class GetInternalCvDownloadUrlQueryHandler : IRequestHandler<GetInternalCvDownloadUrlQuery, GetInternalCvDownloadUrlResponse>
{
    private readonly ICvStorageService _cvStorageService;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly ILogger<GetInternalCvDownloadUrlQueryHandler> _logger;

    public GetInternalCvDownloadUrlQueryHandler(
        ICvStorageService cvStorageService,
        ICandidateCvRepository candidateCvRepository,
        ILogger<GetInternalCvDownloadUrlQueryHandler> logger)
    {
        _cvStorageService = cvStorageService;
        _candidateCvRepository = candidateCvRepository;
        _logger = logger;
    }

    public async Task<GetInternalCvDownloadUrlResponse> Handle(
        GetInternalCvDownloadUrlQuery request,
        CancellationToken cancellationToken)
    {
        var cv = await _candidateCvRepository.GetByIdAsync(request.CvId, cancellationToken);
        if (cv == null)
        {
            _logger.LogWarning("Dịch vụ nội bộ: Không tìm thấy CV với CvId {CvId}", request.CvId);
            throw new NotFoundException($"Không tìm thấy CV với mã {request.CvId}.");
        }

        TimeSpan? expiry = request.ExpiryMinutes.HasValue && request.ExpiryMinutes.Value > 0
            ? TimeSpan.FromMinutes(request.ExpiryMinutes.Value)
            : null;

        var result = await _cvStorageService.GetCvDownloadUrlAsync(request.CvId, expiry, cancellationToken);

        _logger.LogInformation("Dịch vụ nội bộ: Tạo presigned download URL thành công cho CvId {CvId}, hết hạn lúc {ExpiresAt}",
            request.CvId, result.ExpiresAt);

        return new GetInternalCvDownloadUrlResponse
        {
            Success = true,
            Message = "Lấy đường dẫn tải xuống CV thành công.",
            Data = result
        };
    }
}
