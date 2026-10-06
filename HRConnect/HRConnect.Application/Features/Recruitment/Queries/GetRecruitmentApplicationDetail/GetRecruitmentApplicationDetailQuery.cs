using System;
using HRConnect.Application.Features.Recruitment.Common;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;

public record GetRecruitmentApplicationDetailQuery(
    Guid ApplicationId,
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin,
    ScreeningActor? ScreeningActor = null
) : IRequest<RecruitmentApplicationDetailResponse>;
