using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Interviews.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
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
    private readonly IAuditLogService _auditLogService;

    public ScheduleInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        IApplicationRepository applicationRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<ScheduleInterviewCommandHandler> logger,
        IAuditLogService auditLogService)
    {
        _interviewRepository = interviewRepository;
        _applicationRepository = applicationRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
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

        Mf04ConcurrencyGuard.EnsureMatches(
            request.ApplicationConcurrencyToken,
            application.ConcurrencyToken,
            "hồ sơ");

        if (application.Status is not (ApplicationStates.Shortlisted or ApplicationStates.Interview))
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
        else
        {
            _logger.LogWarning("User {UserId} không có quyền tạo lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền tạo lịch phỏng vấn.");
        }

        if (application.Interviews.Any(i => i.Status == InterviewStates.Scheduled))
        {
            throw new BadRequestException("Hồ sơ đã có lịch phỏng vấn đang chờ. Hãy dời, hủy hoặc ghi kết quả lịch hiện tại trước.");
        }

        var interviewRound = (request.InterviewRound.HasValue && request.InterviewRound.Value > 0)
            ? request.InterviewRound.Value
            : (application.Interviews.Any() ? application.Interviews.Max(i => i.InterviewRound) + 1 : 1);

        if (application.Interviews.Any(i => i.InterviewRound == interviewRound))
        {
            throw new ConflictException($"Vòng phỏng vấn {interviewRound} đã tồn tại.");
        }

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
            Status = InterviewStates.Scheduled,
            CreatedBy = request.CurrentUserId,
            ConcurrencyToken = concurrencyToken,
            CreatedAt = now,
            UpdatedAt = now
        };

        IReadOnlyList<ScheduleInterviewParticipantDto> participantsDto = Array.Empty<ScheduleInterviewParticipantDto>();
        if (request.Participants != null && request.Participants.Any())
        {
            var companyId = application.Job?.CompanyId
                ?? throw new BadRequestException("Không xác định được doanh nghiệp sở hữu job.");
            participantsDto = await InterviewParticipantPolicy.ValidateAndNormalizeAsync(
                request.Participants,
                companyId,
                _companyUserRepository,
                cancellationToken);

            foreach (var participant in participantsDto)
            {
                interview.InterviewParticipants.Add(new InterviewParticipant
                {
                    InterviewId = interviewId,
                    UserId = participant.UserId,
                    Role = participant.Role
                });
            }
        }

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interviewId,
            OldStatus = null,
            NewStatus = InterviewStates.Scheduled,
            OldScheduledAt = null,
            NewScheduledAt = request.ScheduledAt,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = "Lập lịch phỏng vấn mới"
        });

        var oldApplicationStatus = application.Status;
        if (application.Status == ApplicationStates.Shortlisted)
        {
            var oldStatus = application.Status;
            application.Status = ApplicationStates.Interview;
            application.UpdatedAt = now;
            application.ConcurrencyToken = Guid.NewGuid();
            application.ApplicationStatusHistories.Add(new ApplicationStatusHistory
            {
                ApplicationStatusHistoryId = Guid.NewGuid(),
                ApplicationId = application.ApplicationId,
                OldStatus = oldStatus,
                NewStatus = ApplicationStates.Interview,
                ChangedBy = request.CurrentUserId,
                ChangedAt = now,
                Reason = "Đã lập lịch phỏng vấn."
            });
            _applicationRepository.Update(application);
        }

        await _interviewRepository.AddAsync(interview, cancellationToken);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.InterviewScheduled,
            EntityType = "INTERVIEW",
            EntityId = interview.InterviewId,
            ActorUserId = request.CurrentUserId,
            NewValues = new
            {
                applicationId = interview.ApplicationId,
                interviewRound,
                status = interview.Status,
                scheduledAt = interview.ScheduledAt,
                durationMinutes = interview.DurationMinutes,
                interviewType = interview.InterviewType,
                participantCount = interview.InterviewParticipants.Count
            }
        }, cancellationToken);
        if (oldApplicationStatus != application.Status)
        {
            await _auditLogService.AddAsync(new AuditEntry
            {
                Action = AuditActions.ApplicationStatusChanged,
                EntityType = "APPLICATION",
                EntityId = application.ApplicationId,
                ActorUserId = request.CurrentUserId,
                OldValues = new { status = oldApplicationStatus },
                NewValues = new { status = application.Status, sourceAction = AuditActions.InterviewScheduled }
            }, cancellationToken);
        }
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
                Status = InterviewStates.Scheduled,
                ConcurrencyToken = concurrencyToken,
                CreatedAt = now,
                Participants = participantsDto.ToList()
            }
        };
    }
}
