using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Commands.UploadCv;

public class UploadCvCommandHandler : IRequestHandler<UploadCvCommand, UploadCvResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ICvStorageService _cvStorageService;
    private readonly ILogger<UploadCvCommandHandler> _logger;

    public UploadCvCommandHandler(
        ICandidateRepository candidateRepository,
        ICvStorageService cvStorageService,
        ILogger<UploadCvCommandHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _cvStorageService = cvStorageService;
        _logger = logger;
    }

    public async Task<UploadCvResponse> Handle(UploadCvCommand request, CancellationToken cancellationToken)
    {
        Guid candidateId;

        if (request.CandidateId.HasValue && request.CandidateId.Value != Guid.Empty)
        {
            candidateId = request.CandidateId.Value;
        }
        else if (request.UserId.HasValue && request.UserId.Value != Guid.Empty)
        {
            var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId.Value, cancellationToken);
            if (candidate == null)
            {
                _logger.LogWarning("Không tìm thấy hồ sơ ứng viên cho UserId: {UserId}", request.UserId);
                throw new NotFoundException("Không tìm thấy thông tin ứng viên tương ứng.");
            }
            candidateId = candidate.CandidateId;
        }
        else
        {
            throw new BadRequestException("Thiếu thông tin nhận diện ứng viên (CandidateId hoặc UserId).");
        }

        var result = await _cvStorageService.UploadCvPdfAsync(
            candidateId,
            request.FileStream,
            request.FileName,
            request.FileSizeBytes,
            request.Title,
            request.IsPrimary,
            cancellationToken);

        _logger.LogInformation("Ứng viên {CandidateId} đã tải lên CV thành công. CvId: {CvId}, ObjectKey: {ObjectKey}",
            candidateId, result.CvId, result.ObjectKey);

        return new UploadCvResponse
        {
            Success = true,
            Message = "Tải lên CV thành công.",
            Data = result
        };
    }
}
