using HRConnect.Application.Common.Interfaces.Repositories;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Queries.GetActiveSkills;

public sealed class GetActiveSkillsQueryHandler : IRequestHandler<GetActiveSkillsQuery, GetActiveSkillsResponse>
{
    private readonly ISkillRepository _skillRepository;

    public GetActiveSkillsQueryHandler(ISkillRepository skillRepository)
    {
        _skillRepository = skillRepository;
    }

    public async Task<GetActiveSkillsResponse> Handle(
        GetActiveSkillsQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var (skills, totalCount) = await _skillRepository.GetActiveAsync(
            request.Search,
            page,
            pageSize,
            cancellationToken);

        return new GetActiveSkillsResponse(
            skills.Select(skill => new ActiveSkillDto(skill.SkillId, skill.SkillName, skill.Category)).ToList(),
            page,
            pageSize,
            totalCount,
            totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize));
    }
}
