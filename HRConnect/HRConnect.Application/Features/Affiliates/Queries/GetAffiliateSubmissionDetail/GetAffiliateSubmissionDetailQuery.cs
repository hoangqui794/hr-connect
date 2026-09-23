using System;
using MediatR;

namespace HRConnect.Application.Features.Affiliates.Queries.GetAffiliateSubmissionDetail;

public sealed record GetAffiliateSubmissionDetailQuery(
    Guid SubmissionId,
    Guid UserId
) : IRequest<AffiliateSubmissionDetailResponse>;
