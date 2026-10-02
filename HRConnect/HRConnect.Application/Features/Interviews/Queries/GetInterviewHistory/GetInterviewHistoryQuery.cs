using System;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Queries.GetInterviewHistory;

public record GetInterviewHistoryQuery(
    Guid InterviewId,
    Guid CurrentUserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false,
    bool IsCandidate = false
) : IRequest<GetInterviewHistoryResponse>;
