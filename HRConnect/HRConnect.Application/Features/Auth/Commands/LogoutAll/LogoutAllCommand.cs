using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.LogoutAll;

public record LogoutAllCommand : IRequest<LogoutAllResponse>
{
    [JsonIgnore]
    public Guid? UserId { get; set; }
}
