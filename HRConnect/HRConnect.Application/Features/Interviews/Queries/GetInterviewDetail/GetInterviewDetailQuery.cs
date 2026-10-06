using System;
using MediatR;

namespace HRConnect.Application.Features.Interviews.Queries.GetInterviewDetail;

public record GetInterviewDetailQuery(
    Guid InterviewId,
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin,
    bool IsCandidate = false
) : IRequest<GetInterviewDetailResponse>;
