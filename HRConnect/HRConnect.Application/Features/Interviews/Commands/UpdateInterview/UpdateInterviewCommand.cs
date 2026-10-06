using System;
using System.Collections.Generic;
using HRConnect.Application.Features.Interviews.Commands.ScheduleInterview;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.UpdateInterview;

public record UpdateInterviewCommand(
    Guid InterviewId,
    int? DurationMinutes,
    string? InterviewType,
    string? Location,
    string? MeetingLink,
    List<ScheduleInterviewParticipantDto>? Participants,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<UpdateInterviewResponse>;
