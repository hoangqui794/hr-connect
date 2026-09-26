using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;

public class ScheduleInterviewCommandHandler : IRequestHandler<ScheduleInterviewCommand, ScheduleInterviewResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly IApplicationRepository _applicationRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ScheduleInterviewCommandHandler> _logger;

    public ScheduleInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<ScheduleInterviewCommandHandler> logger)
    {
        _interviewRepository = interviewRepository;
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<ScheduleInterviewResponse> Handle(ScheduleInterviewCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        if (request.ScheduledAt <= now)
        {
            throw new BadRequestException("Thời gian phỏng vấn phải ở tương lai.");
        }

        var durationMinutes = request.DurationMinutes.GetValueOrDefault(60);
        if (durationMinutes <= 0)
        {
            throw new BadRequestException("Thời lượng phỏng vấn phải lớn hơn 0 phút.");
        }
        if (durationMinutes > 480)
        {
            throw new BadRequestException("Thời lượng phỏng vấn không được vượt quá 480 phút.");
        }

        var application = await _applicationRepository.GetByIdAsync(request.ApplicationId, cancellationToken);
        if (application == null)
        {
            _logger.LogWarning("Không tìm thấy hồ sơ ứng tuyển {ApplicationId}.", request.ApplicationId);
            throw new NotFoundException("Không tìm thấy hồ sơ ứng tuyển.");
        }

        if (application.Status is "REJECTED" or "WITHDRAWN" or "CANCELLED" or "HIRED")
        {
            _logger.LogWarning("Hồ sơ {ApplicationId} đang ở trạng thái {Status}, không thể tạo lịch phỏng vấn.",
                application.ApplicationId, application.Status);
            throw new BadRequestException($"Không thể tạo lịch phỏng vấn cho hồ sơ đang ở trạng thái {application.Status}.");
        }

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (companyUser == null)
            {
                _logger.LogWarning("Tài khoản {UserId} không thuộc doanh nghiệp nào.", request.CurrentUserId);
                throw new ForbiddenException("Tài khoản không thuộc doanh nghiệp nào.");
            }

            if (application.Job?.CompanyId != companyUser.CompanyId)
            {
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố tạo lịch phỏng vấn cho job của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, application.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền tạo lịch phỏng vấn cho ứng viên của doanh nghiệp khác.");
            }
        }
        else if (!request.IsInternalHrOrAdmin)
        {
            _logger.LogWarning("User {UserId} không có quyền tạo lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền tạo lịch phỏng vấn.");
        }

        var interviewRound = (request.InterviewRound.HasValue && request.InterviewRound.Value > 0)
            ? request.InterviewRound.Value
            : (application.Interviews?.Count ?? 0) + 1;

        var interviewType = string.IsNullOrWhiteSpace(request.InterviewType)
            ? "ONLINE"
            : request.InterviewType.Trim().ToUpperInvariant();

        var interviewId = Guid.NewGuid();
        var concurrencyToken = Guid.NewGuid();

        var interview = new Interview
        {
            InterviewId = interviewId,
            ApplicationId = application.ApplicationId,
            InterviewRound = interviewRound,
            InterviewType = interviewType,
            ScheduledAt = request.ScheduledAt,
            DurationMinutes = durationMinutes,
            Location = request.Location,
            MeetingLink = request.MeetingLink,
            Status = "SCHEDULED",
            CreatedBy = request.CurrentUserId,
            ConcurrencyToken = concurrencyToken,
            CreatedAt = now,
            UpdatedAt = now
        };

        var participantsDto = new List<ScheduleInterviewParticipantDto>();
        if (request.Participants != null && request.Participants.Any())
        {
            foreach (var p in request.Participants)
            {
                var role = string.IsNullOrWhiteSpace(p.Role) ? "INTERVIEWER" : p.Role.Trim().ToUpperInvariant();
                interview.InterviewParticipants.Add(new InterviewParticipant
                {
                    InterviewId = interviewId,
                    UserId = p.UserId,
                    Role = role
                });

                participantsDto.Add(new ScheduleInterviewParticipantDto(p.UserId, role));
            }
        }

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interviewId,
            OldStatus = null,
            NewStatus = "SCHEDULED",
            OldScheduledAt = null,
            NewScheduledAt = request.ScheduledAt,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = "Lập lịch phỏng vấn mới"
        });

        if (application.Status is "SUBMITTED" or "SHORTLISTED")
        {
            application.Status = "INTERVIEWING";
            application.UpdatedAt = now;
            _applicationRepository.Update(application);
        }

        await _interviewRepository.AddAsync(interview, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new ScheduleInterviewResponse
        {
            Success = true,
            Message = "Tạo lịch phỏng vấn thành công.",
            Data = new ScheduleInterviewData
            {
                InterviewId = interviewId,
                ApplicationId = application.ApplicationId,
                InterviewRound = interviewRound,
                InterviewType = interviewType,
                ScheduledAt = request.ScheduledAt,
                DurationMinutes = durationMinutes,
                Location = request.Location,
                MeetingLink = request.MeetingLink,
                Status = "SCHEDULED",
                ConcurrencyToken = concurrencyToken,
                CreatedAt = now,
                Participants = participantsDto
            }
        };
    }
}
