using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HRConnect.Application.Common.Exceptions;
using HRConnect.Application.Common.Interfaces;
using HRConnect.Application.Common.Interfaces.Repositories;
using HRConnect.Application.Common.Models;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using HRConnect.Application.Features.Interviews.Common;
using HRConnect.Application.Features.Recruitment.Common;
using HRConnect.Domain.Entities;
using HRConnect.Domain.Constants;
using MediatR;
using Microsoft.Extensions.Logging;

namespace HRConnect.Application.Features.Interviews.Commands.UpdateInterview;

public class UpdateInterviewCommandHandler : IRequestHandler<UpdateInterviewCommand, UpdateInterviewResponse>
{
    private readonly IInterviewRepository _interviewRepository;
    private readonly ICompanyUserRepository _companyUserRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<UpdateInterviewCommandHandler> _logger;
    private readonly IAuditLogService _auditLogService;
    private readonly ICandidateRecruitmentDeliveryService? _candidateDeliveryService;

    public UpdateInterviewCommandHandler(
        IInterviewRepository interviewRepository,
        ICompanyUserRepository companyUserRepository,
        IUnitOfWork unitOfWork,
        ILogger<UpdateInterviewCommandHandler> logger,
        IAuditLogService auditLogService,
        ICandidateRecruitmentDeliveryService? candidateDeliveryService = null)
    {
        _interviewRepository = interviewRepository;
        _companyUserRepository = companyUserRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
        _auditLogService = auditLogService;
        _candidateDeliveryService = candidateDeliveryService;
    }

    public async Task<UpdateInterviewResponse> Handle(UpdateInterviewCommand request, CancellationToken cancellationToken)
    {
        var interview = await _interviewRepository.GetByIdForUpdateAsync(request.InterviewId, cancellationToken);
        if (interview == null)
        {
            _logger.LogWarning("Không tìm thấy buổi phỏng vấn {InterviewId}.", request.InterviewId);
            throw new NotFoundException("Không tìm thấy lịch phỏng vấn.");
        }

        if (interview.Status != InterviewStates.Scheduled)
        {
            _logger.LogWarning("Buổi phỏng vấn {InterviewId} đang ở trạng thái {Status}, không thể cập nhật.",
                interview.InterviewId, interview.Status);
            throw new BadRequestException($"Không thể cập nhật buổi phỏng vấn đã ở trạng thái {interview.Status}.");
        }

        Mf04ConcurrencyGuard.EnsureMatches(request.ConcurrencyToken, interview.ConcurrencyToken, "phỏng vấn");

        if (request.DurationMinutes.HasValue &&
            (request.DurationMinutes.Value <= 0 || request.DurationMinutes.Value > 480))
        {
            throw new BadRequestException("Thời lượng phỏng vấn phải từ 1 đến 480 phút.");
        }

        var interviewType = request.InterviewType == null
            ? null
            : Mf04InputPolicy.NormalizeInterviewType(request.InterviewType);
        var location = Mf04InputPolicy.NormalizeOptionalText(
            request.Location,
            Mf04InputPolicy.InterviewLocationMaxLength,
            "Địa điểm phỏng vấn");
        var meetingLink = request.MeetingLink == null
            ? null
            : Mf04InputPolicy.NormalizeMeetingLink(request.MeetingLink);

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
                _logger.LogWarning("User {UserId} thuộc công ty {CompanyId} cố cập nhật Interview của công ty {JobCompanyId}.",
                    request.CurrentUserId, companyUser.CompanyId, interview.Application?.Job?.CompanyId);
                throw new ForbiddenException("Bạn không có quyền cập nhật lịch phỏng vấn của doanh nghiệp khác.");
            }
        }
        else
        {
            _logger.LogWarning("User {UserId} không có quyền cập nhật lịch phỏng vấn.", request.CurrentUserId);
            throw new ForbiddenException("Bạn không có quyền cập nhật lịch phỏng vấn.");
        }

        var effectiveInterviewType = interviewType
            ?? Mf04InputPolicy.NormalizeInterviewType(interview.InterviewType);
        var effectiveLocation = request.Location == null ? interview.Location : location;
        var effectiveMeetingLink = request.MeetingLink == null ? interview.MeetingLink : meetingLink;
        effectiveMeetingLink = Mf04InputPolicy.NormalizeMeetingLink(effectiveMeetingLink);
        Mf04InputPolicy.EnsureInterviewVenue(effectiveInterviewType, effectiveLocation, effectiveMeetingLink);

        var oldValues = new
        {
            durationMinutes = interview.DurationMinutes,
            interviewType = interview.InterviewType,
            location = interview.Location,
            meetingLink = interview.MeetingLink,
            participantCount = interview.InterviewParticipants.Count
        };

        var candidateVisibleDetailsChanged =
            (request.DurationMinutes.HasValue && request.DurationMinutes.Value != interview.DurationMinutes) ||
            (request.InterviewType != null && !string.Equals(interviewType, interview.InterviewType, StringComparison.OrdinalIgnoreCase)) ||
            (request.Location != null && !string.Equals(location, interview.Location, StringComparison.Ordinal)) ||
            (request.MeetingLink != null && !string.Equals(meetingLink, interview.MeetingLink, StringComparison.Ordinal));

        if (request.DurationMinutes.HasValue)
        {
            interview.DurationMinutes = request.DurationMinutes.Value;
        }

        if (interviewType != null)
        {
            interview.InterviewType = interviewType;
        }
        else
        {
            interview.InterviewType = effectiveInterviewType;
        }

        if (request.Location != null)
        {
            interview.Location = location;
        }

        if (request.MeetingLink != null)
        {
            interview.MeetingLink = meetingLink;
        }

        var participantsDto = new List<ScheduleInterviewParticipantDto>();
        if (request.Participants != null)
        {
            var companyId = interview.Application?.Job?.CompanyId
                ?? throw new BadRequestException("Không xác định được doanh nghiệp sở hữu job.");
            var normalizedParticipants = await InterviewParticipantPolicy.ValidateAndNormalizeAsync(
                request.Participants,
                companyId,
                _companyUserRepository,
                cancellationToken);

            interview.InterviewParticipants.Clear();
            foreach (var participant in normalizedParticipants)
            {
                interview.InterviewParticipants.Add(new InterviewParticipant
                {
                    InterviewId = interview.InterviewId,
                    UserId = participant.UserId,
                    Role = participant.Role
                });
                participantsDto.Add(participant);
            }
        }
        else
        {
            participantsDto = interview.InterviewParticipants
                .Select(p => new ScheduleInterviewParticipantDto(p.UserId, p.Role))
                .ToList();
        }

        var now = DateTime.UtcNow;
        var newConcurrencyToken = Guid.NewGuid();
        interview.ConcurrencyToken = newConcurrencyToken;
        interview.UpdatedAt = now;

        _interviewRepository.Update(interview);
        await _auditLogService.AddAsync(new AuditEntry
        {
            Action = AuditActions.InterviewUpdated,
            EntityType = "INTERVIEW",
            EntityId = interview.InterviewId,
            ActorUserId = request.CurrentUserId,
            OldValues = oldValues,
            NewValues = new
            {
                applicationId = interview.ApplicationId,
                durationMinutes = interview.DurationMinutes,
                interviewType = interview.InterviewType,
                location = interview.Location,
                meetingLink = interview.MeetingLink,
                participantCount = interview.InterviewParticipants.Count
            }
        }, cancellationToken);

        CandidateRecruitmentDeliveryOutcome? deliveryOutcome = null;
        if (candidateVisibleDetailsChanged && _candidateDeliveryService != null && interview.Application != null)
        {
            deliveryOutcome = await _candidateDeliveryService.DeliverInterviewAsync(
                interview.Application,
                interview,
                InterviewCandidateDeliveryEvent.Updated,
                reason: null,
                occurredAt: now,
                cancellationToken: cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new UpdateInterviewResponse
        {
            Success = true,
            Message = "Cập nhật lịch phỏng vấn thành công.",
            Data = new UpdateInterviewData
            {
                InterviewId = interview.InterviewId,
                ApplicationId = interview.ApplicationId,
                InterviewRound = interview.InterviewRound,
                InterviewType = interview.InterviewType,
                ScheduledAt = interview.ScheduledAt,
                DurationMinutes = interview.DurationMinutes,
                Location = interview.Location,
                MeetingLink = interview.MeetingLink,
                Status = interview.Status,
                ConcurrencyToken = newConcurrencyToken,
                UpdatedAt = now,
                Participants = participantsDto,
                DeliveryChannel = deliveryOutcome?.Channel.ToApiValue()
            }
        };
    }
}
