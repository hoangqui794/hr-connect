using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationTimeline;

public record GetRecruitmentApplicationTimelineQuery(
    Guid ApplicationId,
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin,
    bool Ascending = true
) : IRequest<RecruitmentApplicationTimelineResponse>;
