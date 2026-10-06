using System.Text.Json.Serialization;
using HRConnect.Application.Features.Candidates.Common;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.ReplaceCandidateSkills;

public sealed class ReplaceCandidateSkillsCommand : IRequest<ReplaceCandidateSkillsResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public List<CandidateSkillInput> Skills { get; set; } = [];
}

public sealed record ReplaceCandidateSkillsResponse(
    bool Success,
    string Message,
    IReadOnlyList<CandidateSkillDto> Data);
