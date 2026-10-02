using System;
using System.Collections.Generic;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;

public record ScheduleInterviewParticipantDto(
    Guid UserId,
    string Role
);

public record ScheduleInterviewCommand(
    Guid ApplicationId,
    DateTime ScheduledAt,
    int? DurationMinutes,
    int? InterviewRound,
    string? InterviewType,
    string? Location,
    string? MeetingLink,
    List<ScheduleInterviewParticipantDto>? Participants,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<ScheduleInterviewResponse>;
