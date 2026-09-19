using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.ResetPassword;

public record ResetPasswordCommand(
    string Email,
    string Otp,
    string NewPassword,
    string? ConfirmPassword = null
) : IRequest<ResetPasswordResponse>;

public class ResetPasswordResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Password has been reset successfully.";
}
