using System;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateApplications;

public record GetCandidateApplicationsQuery(
    Guid UserId,
    string? Status = null,
    Guid? JobId = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    int Page = 1,
    int PageSize = 20
) : IRequest<CandidateApplicationsResponse>;
