using System.Text.Json.Serialization;
using HRConnect.Application.Features.Candidates.Common;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;

public sealed class AddCandidateSkillCommand : IRequest<CandidateSkillMutationResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    public Guid SkillId { get; set; }
    public string? ProficiencyLevel { get; set; }
    public decimal? YearsOfExperience { get; set; }
}

public sealed record CandidateSkillMutationResponse(
    bool Success,
    string Message,
    CandidateSkillDto Data);
