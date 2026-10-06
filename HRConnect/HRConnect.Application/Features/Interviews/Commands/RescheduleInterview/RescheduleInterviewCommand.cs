using System;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.RescheduleInterview;

public record RescheduleInterviewCommand(
    Guid InterviewId,
    DateTime NewScheduledAt,
    string Reason,
    int? DurationMinutes,
    string? Location,
    string? MeetingLink,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<RescheduleInterviewResponse>;
