using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;

public record GetRecruitmentApplicationDetailQuery(
    Guid ApplicationId,
    Guid UserId,
    bool IsClientCompanyUser,
    bool IsInternalHrOrAdmin
) : IRequest<RecruitmentApplicationDetailResponse>;
