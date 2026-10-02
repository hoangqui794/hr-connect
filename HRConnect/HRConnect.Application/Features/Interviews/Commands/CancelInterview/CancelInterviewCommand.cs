using System;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Commands.CancelInterview;

public record CancelInterviewCommand(
    Guid InterviewId,
    string Reason,
    Guid? ConcurrencyToken,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false
) : IRequest<CancelInterviewResponse>;
