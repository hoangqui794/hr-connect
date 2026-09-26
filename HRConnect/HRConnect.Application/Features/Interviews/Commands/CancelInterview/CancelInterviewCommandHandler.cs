using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.CancelInterview;

public class CancelInterviewCommandHandler : IRequestHandler<CancelInterviewCommand, CancelInterviewResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CancelInterviewCommandHandler> _logger;

    public CancelInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<CancelInterviewCommandHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<CancelInterviewResponse> Handle(CancelInterviewCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BadRequestException("Lý do hủy lịch phỏng vấn là bắt buộc.");
        }

        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy lịch phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
        }

        if (interview.Status == "CANCELLED")
        {
            throw new BadRequestException("Buổi phỏng vấn này đã bị hủy trước đó.");
        }

        if (interview.Status == "COMPLETED")
        {
            throw new BadRequestException("Không thể hủy buổi phỏng vấn đã hoàn thành.");
        }

        if (request.ConcurrencyToken.HasValue && request.ConcurrencyToken.Value != interview.ConcurrencyToken)
        {
            _logger.LogWarning("Xung đột concurrency trên Interview {InterviewId}. Token yêu cầu {ReqToken} khác với token hiện tại {CurToken}.",
                interview.InterviewId, request.ConcurrencyToken.Value, interview.ConcurrencyToken);
            throw new ConflictException("Dữ liệu phỏng vấn đã bị thay đổi bởi người khác. Vui lòng tải lại trang.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null)
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (interview.Application?.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố hủy lịch Interview của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền hủy lịch phỏng vấn của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền hủy lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền hủy lịch phỏng vấn.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = interview.Status;

        interview.Status = "CANCELLED";

        var newConcurrencyToken = Guid.NewGuid();
        interview.ConcurrencyToken = newConcurrencyToken;
        interview.UpdatedAt = now;

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            OldStatus = oldStatus,
            NewStatus = "CANCELLED",
            OldScheduledAt = interview.ScheduledAt,
            NewScheduledAt = null,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = request.Reason.Trim()
        });

        _interviewRepository.Update(interview);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new CancelInterviewResponse
        {
            Success = true,
            Message = "Hủy lịch phỏng vấn thành công.",
            Data = new CancelInterviewData
            {
                InterviewId = interview.InterviewId,
                ApplicationId = interview.ApplicationId,
                InterviewRound = interview.InterviewRound,
                Status = "CANCELLED",
                Reason = request.Reason.Trim(),
                ConcurrencyToken = newConcurrencyToken,
                CancelledAt = now
            }
        };
    }
}
