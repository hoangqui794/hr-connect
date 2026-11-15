using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationTimeline;

public record GetRecruitmentApplicationTimelineQuery(
    Guid ApplicationId,
    Guid UserId,
    bool IsClientCompanyUser = false,
    bool IsInternalHrOrAdmin = false,
    bool Ascending = true,
    bool IsCandidate = false
) : IRequest<RecruitmentApplicationTimelineResponse>;
