using System;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetCandidateCvs;

public record GetCandidateCvsQuery(Guid UserId) : IRequest<GetCandidateCvsResponse>;
