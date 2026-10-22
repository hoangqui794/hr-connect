using System;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.RescheduleInterview;

public class RescheduleInterviewCommandHandler : IRequestHandler<RescheduleInterviewCommand, RescheduleInterviewResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<RescheduleInterviewCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;
    private readonly INotificationRepository? _notificationRepository;
    private readonly ICandidateRecruitmentDeliveryService? _candidateDeliveryService;

    public RescheduleInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<RescheduleInterviewCommandHandler> logger,
        IAuditLogService auditLogService,
        INotificationRepository? notificationRepository = null,
        ICandidateRecruitmentDeliveryService? candidateDeliveryService = null)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
        _notificationRepository = notificationRepository;
        _candidateDeliveryService = candidateDeliveryService;
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

        var location = Mf04InputPolicy.NormalizeOptionalText(
            request.Location,
            Mf04InputPolicy.InterviewLocationMaxLength,
            "Địa điểm phỏng vấn");
        var meetingLink = request.MeetingLink == null
            ? null
            : Mf04InputPolicy.NormalizeMeetingLink(request.MeetingLink);

        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy lịch phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
        }

        if (interview.Status != InterviewStates.Scheduled)
        {
            _logger.LogWarning("Buổi phỏng vấn {InterviewId} đang ở trạng thái {Status}, không thể dời lịch.",
                interview.InterviewId, interview.Status);
            throw new BadRequestException($"Không thể dời lịch phỏng vấn đang ở trạng thái {interview.Status}.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, interview.ConcurrencyToken, "phỏng vấn");

        if (request.IsClientCompanyUser)
        {
            var companyUser = await _companyUserRepository.GetByUserIdAsync(request.CurrentUserId, cancellationToken);
            if (!HRConnect.Application.Features.Recruitment.Common.CompanyMembershipPolicy.IsActive(companyUser))
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
        else
        {
            _logger.LogWarning("User {UserId} không có quyền dời lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền dời lịch phỏng vấn.");
        }

        var interviewType = Mf04InputPolicy.NormalizeInterviewType(interview.InterviewType);
        var effectiveLocation = request.Location == null ? interview.Location : location;
        var effectiveMeetingLink = request.MeetingLink == null ? interview.MeetingLink : meetingLink;
        effectiveMeetingLink = Mf04InputPolicy.NormalizeMeetingLink(effectiveMeetingLink);
        Mf04InputPolicy.EnsureInterviewVenue(interviewType, effectiveLocation, effectiveMeetingLink);

        var oldStatus = interview.Status;
        var oldScheduledAt = interview.ScheduledAt;

        interview.ScheduledAt = request.NewScheduledAt;
        interview.Status = InterviewStates.Scheduled;
        // A confirmation applies to one concrete timeslot. Once the company moves
        // the interview, the Candidate must explicitly confirm the new time.
        interview.CandidateAttendanceStatus = null;
        interview.CandidateRespondedAt = null;

        if (request.DurationMinutes.HasValue)
        {
            interview.DurationMinutes = request.DurationMinutes.Value;
        }

        if (request.Location != null)
        {
            interview.Location = location;
        }

        if (request.MeetingLink != null)
        {
            interview.MeetingLink = meetingLink;
        }

        interview.InterviewType = interviewType;

        var newConcurrencyToken = Guid.NewGuid();
        interview.ConcurrencyToken = newConcurrencyToken;
        interview.UpdatedAt = now;

        interview.InterviewStatusHistories.Add(new InterviewStatusHistory
        {
            InterviewStatusHistoryId = Guid.NewGuid(),
            InterviewId = interview.InterviewId,
            OldStatus = oldStatus,
            NewStatus = InterviewStates.Scheduled,
            OldScheduledAt = oldScheduledAt,
            NewScheduledAt = request.NewScheduledAt,
            ChangedBy = request.CurrentUserId,
            ChangedAt = now,
            Reason = request.Reason.Trim()
        });

        _interviewRepository.Update(interview);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.InterviewRescheduled,
            EntityType = "INTERVIEW",
            EntityId = interview.InterviewId,
            ActorUserId = request.CurrentUserId,
            OldValues = new { status = oldStatus, scheduledAt = oldScheduledAt },
            NewValues = new
            {
                applicationId = interview.ApplicationId,
                status = interview.Status,
                scheduledAt = interview.ScheduledAt,
                durationMinutes = interview.DurationMinutes,
                hasReason = true
            }
        }, cancellationToken);

        CandidateRecruitmentDeliveryOutcome? deliveryOutcome = null;
        if (_candidateDeliveryService != null && interview.Application != null)
        {
            deliveryOutcome = await _candidateDeliveryService.DeliverInterviewAsync(
                interview.Application,
                interview,
                InterviewCandidateDeliveryEvent.Rescheduled,
                request.Reason.Trim(),
                now,
                cancellationToken: cancellationToken);
        }
        else if (_notificationRepository != null && interview.Application?.Candidate?.UserId is { } candidateUserId)
        {
            await _notificationRepository.AddAsync(new Notification
            {
                NotificationId = Guid.NewGuid(),
                UserId = candidateUserId,
                NotificationType = "INTERVIEW",
                Title = $"Dời lịch phỏng vấn Vòng {interview.InterviewRound}",
                Message = $"Lịch phỏng vấn Vòng {interview.InterviewRound} đã được dời sang {interview.ScheduledAt:dd/MM/yyyy HH:mm}.",
                RelatedEntityType = "INTERVIEW",
                RelatedEntityId = interview.InterviewId,
                Metadata = System.Text.Json.JsonSerializer.Serialize(new
                {
                    applicationId = interview.ApplicationId,
                    interviewId = interview.InterviewId,
                    round = interview.InterviewRound,
                    newScheduledAt = interview.ScheduledAt
                }),
                IsRead = false,
                CreatedAt = now
            }, cancellationToken);
        }

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
                Status = InterviewStates.Scheduled,
                Reason = request.Reason.Trim(),
                ConcurrencyToken = newConcurrencyToken,
                RescheduledAt = now,
                DeliveryChannel = deliveryOutcome is null ? null : deliveryOutcome.Channel.ToApiValue()
            }
        };
    }
}
