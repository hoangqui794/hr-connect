using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Candidates.Commands.RemoveCandidateSkill;

public sealed class RemoveCandidateSkillCommand : IRequest<RemoveCandidateSkillResponse>
{
    [JsonIgnore]
    public Guid UserId { get; set; }

    [JsonIgnore]
    public Guid SkillId { get; set; }
}

public sealed record RemoveCandidateSkillResponse(bool Success, string Message, Guid SkillId);
