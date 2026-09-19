using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.ForgotPassword;

public record ForgotPasswordCommand(string Email) : IRequest<ForgotPasswordResponse>;

public class ForgotPasswordResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "If the email is registered, a password reset code has been sent.";
}
