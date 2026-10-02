using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.RescheduleInterview;

public class RescheduleInterviewCommandHandler : IRequestHandler<RescheduleInterviewCommand, RescheduleInterviewResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RescheduleInterviewCommandHandler> _logger;

    public RescheduleInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<RescheduleInterviewCommandHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<RescheduleInterviewResponse> Handle(RescheduleInterviewCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        if (request.NewScheduledAt <= now)
        {
            throw new BadRequestException("Thời gian phỏng vấn mới phải ở tương lai.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BadRequestException("Lý do dời lịch phỏng vấn là bắt buộc.");
        }

        if (request.DurationMinutes.HasValue && (request.DurationMinutes.Value <= 0 || request.DurationMinutes.Value > 480))
        {
            throw new BadRequestException("Thời lượng phỏng vấn phải từ 1 đến 480 phút.");
        }

        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy lịch phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
        }

        if (interview.Status is not ("SCHEDULED" or "RESCHEDULED"))
        {
            _logger.LogWarning("Buổi phỏng vấn {InterviewId} đang ở trạng thái {Status}, không thể dời lịch.",
                interview.InterviewId, interview.Status);
            throw new BadRequestException($"Không thể dời lịch phỏng vấn đang ở trạng thái {interview.Status}.");
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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố dời lịch Interview của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền dời lịch phỏng vấn của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền dời lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền dời lịch phỏng vấn.");
        }

        var oldStatus = interview.Status;
        var oldScheduledAt = interview.ScheduledAt;

        interview.ScheduledAt = request.NewScheduledAt;
        interview.Status = "RESCHEDULED";

        if (request.DurationMinutes.HasValue)
        {
            interview.DurationMinutes = request.DurationMinutes.Value;
        }

        if (request.Location != null)
        {
            interview.Location = request.Location;
        }

        if (request.MeetingLink != null)
        {
            interview.MeetingLink = request.MeetingLink;
        }

        var newConcurrencyToken = Guid.NewGuid();
        interview.ConcurrencyToken = newConcurrencyToken;
        interview.UpdatedAt = now;

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            OldStatus = oldStatus,
            NewStatus = "RESCHEDULED",
            OldScheduledAt = oldScheduledAt,
            NewScheduledAt = request.NewScheduledAt,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = request.Reason.Trim()
        });

        _interviewRepository.Update(interview);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new RescheduleInterviewResponse
        {
            Success = true,
            Message = "Dời lịch phỏng vấn thành công.",
            Data = new RescheduleInterviewData
            {
                InterviewId = interview.InterviewId,
                ApplicationId = interview.ApplicationId,
                InterviewRound = interview.InterviewRound,
                OldScheduledAt = oldScheduledAt,
                NewScheduledAt = request.NewScheduledAt,
                Status = "RESCHEDULED",
                Reason = request.Reason.Trim(),
                ConcurrencyToken = newConcurrencyToken,
                RescheduledAt = now
            }
        };
    }
}
