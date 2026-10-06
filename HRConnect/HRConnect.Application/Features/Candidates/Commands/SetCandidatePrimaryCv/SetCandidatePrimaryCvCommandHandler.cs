using System;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Commands.SetCandidatePrimaryCv;

public class SetCandidatePrimaryCvCommandHandler : IRequestHandler<SetCandidatePrimaryCvCommand, SetCandidatePrimaryCvResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<SetCandidatePrimaryCvCommandHandler> _logger;

    public SetCandidatePrimaryCvCommandHandler(
        ICandidateRepository candidateRepository,
        ICandidateCvRepository candidateCvRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        ILogger<SetCandidatePrimaryCvCommandHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _candidateCvRepository = candidateCvRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<SetCandidatePrimaryCvResponse> Handle(SetCandidatePrimaryCvCommand request, CancellationToken cancellationToken)
    {
        var candidate = await _candidateRepository.GetByUserIdAsync(request.UserId, cancellationToken);
        if (candidate == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng viên cho UserId {UserId}", request.UserId);
            throw new NotFoundException("Không tìm thấy thông tin ứng viên tương ứng với tài khoản.");
        }

        var targetCv = await _candidateCvRepository.GetByIdAsync(request.CvId, cancellationToken);
        if (targetCv == null || targetCv.Status != "ACTIVE")
        {
            _logger.LogWarning("Không tìm thấy CV hoạt động với CvId: {CvId}", request.CvId);
            throw new NotFoundException($"Không tìm thấy CV với mã {request.CvId}.");
        }

        if (targetCv.CandidateId != candidate.CandidateId)
        {
            _logger.LogWarning("UserId {UserId} cố gắng thiết lập CV {CvId} thuộc ứng viên khác {OwnerId} làm CV chính.",
                request.UserId, request.CvId, targetCv.CandidateId);
            throw new ForbiddenException("Bạn không có quyền thiết lập CV này làm CV chính.");
        }

        if (targetCv.IsPrimary)
        {
            return new SetCandidatePrimaryCvResponse
            {
                Success = true,
                Message = "CV này hiện đã là CV chính.",
                Data = MapToItemResponse(targetCv)
            };
        }

        var now = DateTime.UtcNow;
        var currentPrimary = await _candidateCvRepository.GetPrimaryByCandidateIdAsync(candidate.CandidateId, cancellationToken);
        if (currentPrimary != null && currentPrimary.CvId != targetCv.CvId)
        {
            currentPrimary.IsPrimary = false;
            currentPrimary.UpdatedAt = now;
            _candidateCvRepository.Update(currentPrimary);
        }

        targetCv.IsPrimary = true;
        targetCv.UpdatedAt = now;
        _candidateCvRepository.Update(targetCv);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.CvPrimarySet,
            EntityType = "CANDIDATE_CV",
            EntityId = targetCv.CvId,
            ActorUserId = request.UserId,
            OldValues = new { previousPrimaryCvId = currentPrimary?.CvId },
            NewValues = new { primaryCvId = targetCv.CvId }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Ứng viên {CandidateId} đã thiết lập CV {CvId} làm CV chính.", candidate.CandidateId, targetCv.CvId);

        return new SetCandidatePrimaryCvResponse
        {
            Success = true,
            Message = "Đặt CV chính thành công.",
            Data = MapToItemResponse(targetCv)
        };
    }

    private static CandidateCvItemResponse MapToItemResponse(Domain.Entities.CandidateCv cv)
    {
        return new CandidateCvItemResponse
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
        };
    }
}
