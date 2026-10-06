using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetActiveSkills;

public sealed record GetActiveSkillsQuery(string? Search, int Page = 1, int PageSize = 20)
    : IRequest<GetActiveSkillsResponse>;
