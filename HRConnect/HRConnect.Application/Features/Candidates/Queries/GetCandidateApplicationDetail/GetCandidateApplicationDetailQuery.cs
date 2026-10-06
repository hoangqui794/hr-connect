using System;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateApplicationDetail;

public sealed record GetCandidateApplicationDetailQuery(
    Guid ApplicationId,
    Guid UserId
) : IRequest<CandidateApplicationDetailResponse>;
