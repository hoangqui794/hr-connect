using System;
using MediatR;

namespace HRConnect.Application.Features.Recruitment.Queries.GetRecruitmentApplicationDetail;

public record GetCandidateRecruitmentApplicationDetailQuery(
    Guid ApplicationId,
    Guid UserId
) : IRequest<CandidateRecruitmentApplicationDetailResponse>;
