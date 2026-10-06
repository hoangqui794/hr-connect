namespace HRConnect.Application.Features.Candidates.Queries.GetActiveSkills;

public sealed record GetActiveSkillsResponse(
    IReadOnlyList<ActiveSkillDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages);

public sealed record ActiveSkillDto(Guid SkillId, string SkillName, string? Category);
