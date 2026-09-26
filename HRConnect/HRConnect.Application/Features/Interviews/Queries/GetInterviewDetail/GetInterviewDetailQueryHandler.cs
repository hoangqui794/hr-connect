using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Queries.GetInterviewDetail;

public class GetInterviewDetailQueryHandler : IRequestHandler<GetInterviewDetailQuery, GetInterviewDetailResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly ILogger<GetInterviewDetailQueryHandler> _logger;

    public GetInterviewDetailQueryHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        ILogger<GetInterviewDetailQueryHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _logger = logger;
    }

    public async Task<GetInterviewDetailResponse> Handle(GetInterviewDetailQuery request, CancellationToken cancellationToken)
    {
        var interview = await _interviewRepository.GetByIdWithDetailsAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy thông tin phỏng vấn với InterviewId: {InterviewId}", request.InterviewId);
            throw new NotFoundException("Không tìm thấy thông tin lịch phỏng vấn.");
        }

        if (request.IsClientCompanyUser)
        {
            var member = await _companyUserRepository.GetByUserIdAsync(request.UserId, cancellationToken);
            if (member == null || member.CompanyId != interview.Application?.Job?.CompanyId)
            {
                _logger.LogWarning("Tài khoản Client {UserId} không có quyền xem phỏng vấn thuộc công ty {CompanyId}", request.UserId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền xem thông tin lịch phỏng vấn của công ty khác.");
            }
        }
        else if (request.IsCandidate)
        {
            if (interview.Application?.Candidate?.UserId != request.UserId)
            {
                _logger.LogWarning("Ứng viên {UserId} cố gắng truy cập lịch phỏng vấn không phải của mình", request.UserId);
                throw new ForbiddenException("Bạn không có quyền xem thông tin lịch phỏng vấn này.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("Người dùng {UserId} không có quyền xem chi tiết lịch phỏng vấn.", request.UserId);
            throw new ForbiddenException("Bạn không có quyền xem chi tiết lịch phỏng vấn.");
        }

        var participants = (interview.InterviewParticipants ?? new List<Domain.Entities.InterviewParticipant>())
            .Select(p => new InterviewParticipantDetailDto
            {
                UserId = p.UserId,
                Name = p.User?.DisplayName ?? p.User?.Email,
                Role = p.Role
            }).ToList();

        var histories = (interview.InterviewStatusHistories ?? new List<Domain.Entities.InterviewStatusHistory>())
            .OrderByDescending(h => h.ChangedAt)
            .Select(h => new InterviewStatusHistoryDetailDto
            {
                InterviewStatusHistoryId = h.InterviewStatusHistoryId,
                OldStatus = h.OldStatus,
                NewStatus = h.NewStatus,
                OldScheduledAt = h.OldScheduledAt,
                NewScheduledAt = h.NewScheduledAt,
                ChangedBy = h.ChangedBy,
                ChangedByName = h.ChangedByNavigation?.DisplayName ?? h.ChangedByNavigation?.Email,
                Reason = h.Reason,
                ChangedAt = h.ChangedAt
            }).ToList();

        var data = new InterviewDetailData
        {
            InterviewId = interview.InterviewId,
            ApplicationId = interview.ApplicationId,
            JobId = interview.Application?.JobId ?? Guid.Empty,
            JobTitle = interview.Application?.Job?.Title ?? string.Empty,
            CompanyId = interview.Application?.Job?.CompanyId ?? Guid.Empty,
            CompanyName = interview.Application?.Job?.Company?.CompanyName ?? string.Empty,
            CandidateId = interview.Application?.CandidateId ?? Guid.Empty,
            CandidateFullName = interview.Application?.Candidate?.FullName ?? string.Empty,
            CandidateEmail = interview.Application?.Candidate?.Email,
            CandidatePhone = interview.Application?.Candidate?.Phone,
            InterviewRound = interview.InterviewRound,
            InterviewType = interview.InterviewType,
            ScheduledAt = interview.ScheduledAt,
            DurationMinutes = interview.DurationMinutes,
            Location = interview.Location,
            MeetingLink = interview.MeetingLink,
            Status = interview.Status,
            Result = interview.Result,
            Feedback = interview.Feedback,
            CreatedBy = interview.CreatedBy,
            CreatedByName = interview.CreatedByNavigation?.DisplayName ?? interview.CreatedByNavigation?.Email,
            RecordedBy = interview.RecordedBy,
            RecordedByName = interview.RecordedByNavigation?.DisplayName ?? interview.RecordedByNavigation?.Email,
            RecordedAt = interview.RecordedAt,
            CreatedAt = interview.CreatedAt,
            UpdatedAt = interview.UpdatedAt,
            ConcurrencyToken = interview.ConcurrencyToken,
            Participants = participants,
            StatusHistories = histories
        };

        return new GetInterviewDetailResponse
        {
            Success = true,
            Message = "Lấy chi tiết lịch phỏng vấn thành công.",
            Data = data
        };
    }
}
