using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.RecordInterviewResult;

public class RecordInterviewResultCommandHandler : IRequestHandler<RecordInterviewResultCommand, RecordInterviewResultResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RecordInterviewResultCommandHandler> _logger;

    public RecordInterviewResultCommandHandler(
        IInterviewRepository interviewRepository,
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<RecordInterviewResultCommandHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<RecordInterviewResultResponse> Handle(RecordInterviewResultCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Result))
        {
            throw new BadRequestException("Kết quả phỏng vấn là bắt buộc.");
        }

        var normalizedResult = request.Result.Trim().ToUpperInvariant();
        if (normalizedResult is not ("PASSED" or "FAILED" or "ON_HOLD"))
        {
            throw new BadRequestException("Kết quả phỏng vấn không hợp lệ. Giá trị cho phép: PASSED, FAILED, ON_HOLD.");
        }

        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy lịch phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
        }

        if (interview.Status == "CANCELLED")
        {
            throw new BadRequestException("Không thể ghi nhận kết quả cho buổi phỏng vấn đã bị hủy.");
        }

        if (interview.Status == "COMPLETED")
        {
            throw new BadRequestException("Buổi phỏng vấn này đã được ghi nhận kết quả trước đó.");
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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố ghi nhận kết quả Interview của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền ghi nhận kết quả phỏng vấn của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền ghi nhận kết quả phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền ghi nhận kết quả phỏng vấn.");
        }

        var now = DateTime.UtcNow;
        var oldStatus = interview.Status;

        interview.Result = normalizedResult;
        interview.Feedback = request.Feedback;
        interview.Status = "COMPLETED";
        interview.RecordedBy = request.CurrentUserId;
        interview.RecordedAt = now;

        var newConcurrencyToken = Guid.NewGuid();
        interview.ConcurrencyToken = newConcurrencyToken;
        interview.UpdatedAt = now;

        var reasonText = $"Ghi nhận kết quả: {normalizedResult}.";
        if (!string.IsNullOrWhiteSpace(request.Feedback))
        {
            reasonText += $" Nhận xét: {request.Feedback.Trim()}";
        }

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            OldStatus = oldStatus,
            NewStatus = "COMPLETED",
            OldScheduledAt = interview.ScheduledAt,
            NewScheduledAt = interview.ScheduledAt,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = reasonText
        });

        if (interview.Application != null)
        {
            if (normalizedResult == "FAILED")
            {
                if (request.IsFinalRound || string.Equals(request.NextAction, "REJECT", StringComparison.OrdinalIgnoreCase))
                {
                    interview.Application.Status = "REJECTED";
                    interview.Application.UpdatedAt = now;
                    _applicationRepository.Update(interview.Application);
                }
            }
            else if (normalizedResult == "PASSED")
            {
                if (request.IsFinalRound || string.Equals(request.NextAction, "MAKE_OFFER", StringComparison.OrdinalIgnoreCase))
                {
                    interview.Application.Status = "OFFER_PENDING";
                    interview.Application.UpdatedAt = now;
                    _applicationRepository.Update(interview.Application);
                }
            }
        }

        _interviewRepository.Update(interview);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new RecordInterviewResultResponse
        {
            Success = true,
            Message = "Ghi nhận kết quả phỏng vấn thành công.",
            Data = new RecordInterviewResultData
            {
                InterviewId = interview.InterviewId,
                ApplicationId = interview.ApplicationId,
                InterviewRound = interview.InterviewRound,
                Status = "COMPLETED",
                Result = normalizedResult,
                Feedback = request.Feedback,
                ApplicationStatus = interview.Application?.Status,
                RecordedBy = request.CurrentUserId,
                RecordedAt = now,
                ConcurrencyToken = newConcurrencyToken
            }
        };
    }
}
