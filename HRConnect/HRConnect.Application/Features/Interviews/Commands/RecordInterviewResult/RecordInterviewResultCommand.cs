using System;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.RecordInterviewResult;

public record RecordInterviewResultCommand(
    Guid InterviewId,
    string Result,
    string? Feedback,
    bool IsFinalRound,
    string? NextAction,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<RecordInterviewResultResponse>;
