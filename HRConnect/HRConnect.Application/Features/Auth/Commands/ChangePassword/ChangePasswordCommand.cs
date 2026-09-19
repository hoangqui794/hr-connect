using System.Text.Json.Serialization;
using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.ChangePassword;

public record ChangePasswordCommand(
    string CurrentPassword,
    string NewPassword,
    string? ConfirmPassword = null
) : IRequest<ChangePasswordResponse>
{
    [JsonIgnore]
    public Guid? UserId { get; set; }
}

public class ChangePasswordResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Password changed successfully.";
}
