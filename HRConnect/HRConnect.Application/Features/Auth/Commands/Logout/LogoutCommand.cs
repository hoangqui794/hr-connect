using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.Logout;

public record LogoutCommand(string RefreshToken) : IRequest<LogoutResponse>
{
    [JsonIgnore]
    public Guid? UserId { get; set; }
}
