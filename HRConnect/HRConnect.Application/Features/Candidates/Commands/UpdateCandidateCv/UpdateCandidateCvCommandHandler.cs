using System;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateCv;

public class UpdateCandidateCvCommandHandler : IRequestHandler<UpdateCandidateCvCommand, UpdateCandidateCvResponse>
{
    private readonly ICandidateRepository _candidateRepository;
    private readonly ICandidateCvRepository _candidateCvRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<UpdateCandidateCvCommandHandler> _logger;

    public UpdateCandidateCvCommandHandler(
        ICandidateRepository candidateRepository,
        ICandidateCvRepository candidateCvRepository,
        IUnitOfWork unitOfWork,
        IAuditLogService auditLogService,
        ILogger<UpdateCandidateCvCommandHandler> logger)
    {
        _candidateRepository = candidateRepository;
        _candidateCvRepository = candidateCvRepository;
        _unitOfWork = unitOfWork;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<UpdateCandidateCvResponse> Handle(UpdateCandidateCvCommand request, CancellationToken cancellationToken)
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
            _logger.LogWarning("UserId {UserId} cố gắng cập nhật CV {CvId} thuộc về ứng viên khác {OwnerId}.",
                request.UserId, request.CvId, cv.CandidateId);
            throw new ForbiddenException("Bạn không có quyền chỉnh sửa thông tin CV này.");
        }

        var oldTitle = cv.Title;
        var trimmedTitle = request.Title.Trim();
        cv.Title = trimmedTitle;
        cv.UpdatedAt = DateTime.UtcNow;

        _candidateCvRepository.Update(cv);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.CvUpdated,
            EntityType = "CANDIDATE_CV",
            EntityId = cv.CvId,
            ActorUserId = request.UserId,
            OldValues = new { title = oldTitle },
            NewValues = new { title = trimmedTitle }
        }, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Ứng viên {CandidateId} đã cập nhật tiêu đề CV {CvId} thành '{Title}'.",
            candidate.CandidateId, cv.CvId, trimmedTitle);

        return new UpdateCandidateCvResponse
        {
            Success = true,
            Message = "Cập nhật thông tin CV thành công.",
            Data = new CandidateCvItemResponse
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
            }
        };
    }
}
