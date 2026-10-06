using System.Text.Json.Serialization;
using HRConnect.Application.Features.Candidates.Commands.AddCandidateSkill;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.UpdateCandidateSkill;

public sealed class UpdateCandidateSkillCommand : IRequest<CandidateSkillMutationResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    [JsonIgnore]
    public Guid SkillId { get; set; }

    public string? ProficiencyLevel { get; set; }
    public decimal? YearsOfExperience { get; set; }
}
