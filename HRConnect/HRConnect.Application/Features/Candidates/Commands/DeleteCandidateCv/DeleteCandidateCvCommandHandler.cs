using System;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Commands.DeleteCandidateCv;

public class DeleteCandidateCvCommandHandler : IRequestHandler<DeleteCandidateCvCommand, DeleteCandidateCvResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly ICvStorageService _cvStorageService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DeleteCandidateCvCommandHandler> _logger;

    public DeleteCandidateCvCommandHandler(
        ICandidateRepository candidateRepository,
        ICandidateCvRepository candidateCvRepository,
        ICvStorageService cvStorageService,
        IUnitOfWork unitOfWork,
        ILogger<DeleteCandidateCvCommandHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _candidateCvRepository = candidateCvRepository;
        _cvStorageService = cvStorageService;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<DeleteCandidateCvResponse> Handle(DeleteCandidateCvCommand request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng viên cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin ứng viên tương ứng với tài khoản.");
        }

        var cv = await _candidateCvRepository.GetByIdAsync(request.CvId, cancellationToken);
        if (cv == null || cv.Status != "ACTIVE")
        {
            _logger.LogWarning("Không tìm thấy CV hoạt động với CvId: {CvId}", request.CvId);
            throw new NotFoundException($"Không tìm thấy CV với mã {request.CvId}.");
        }

        if (cv.CandidateId != candidate.CandidateId)
        {
            _logger.LogWarning("UserId {UserId} cố gắng xóa CV {CvId} thuộc về ứng viên khác {OwnerId}.",
                request.UserId, request.CvId, cv.CandidateId);
            throw new ForbiddenException("Bạn không có quyền xóa CV này.");
        }

        var isInUse = await _candidateCvRepository.IsCvInUseAsync(cv.CvId, cancellationToken);
        if (isInUse)
        {
            // CASE B: CV đã được tham chiếu bởi hồ sơ ứng tuyển (Application/Submission).
            // Không xóa cứng DB và không xóa R2 để bảo toàn lịch sử tuyển dụng.
            // Chỉ vô hiệu hóa / gỡ hiển thị khỏi kho CV cá nhân của ứng viên.
            cv.Status = "DELETED";
            cv.IsPrimary = false;
            cv.UpdatedAt = DateTime.UtcNow;

            _candidateCvRepository.Update(cv);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("CV {CvId} đã được tham chiếu trong Application; đã ẩn khỏi kho CV của Candidate {CandidateId}.",
                cv.CvId, candidate.CandidateId);

            return new DeleteCandidateCvResponse
            {
                Success = true,
                Message = "CV đã được sử dụng trong hồ sơ ứng tuyển nên được gỡ khỏi kho hiển thị; lịch sử ứng tuyển vẫn được bảo toàn."
            };
        }
        else
        {
            // CASE A: CV chưa từng được nộp/sử dụng bởi bất kỳ Application nào.
            // Xóa an toàn hoàn toàn khỏi cơ sở dữ liệu và Cloudflare R2 bucket.
            await _cvStorageService.DeleteCvAsync(cv.CvId, cancellationToken);

            _logger.LogInformation("CV {CvId} chưa từng sử dụng; đã xóa vật lý hoàn toàn khỏi CSDL và R2 cho Candidate {CandidateId}.",
                cv.CvId, candidate.CandidateId);

            return new DeleteCandidateCvResponse
            {
                Success = true,
                Message = "Xóa CV khỏi kho CV cá nhân thành công."
            };
        }
    }
}
