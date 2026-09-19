using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.ResendPasswordResetOtp;

public record ResendPasswordResetOtpCommand(string Email) : IRequest<ResendPasswordResetOtpResponse>;

public class ResendPasswordResetOtpResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "If the email is registered, a new password reset code has been sent.";
}
