using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.ForgotPassword;

public record ForgotPasswordCommand(string Email) : IRequest<ForgotPasswordResponse>;

public class ForgotPasswordResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Nếu email đã được đăng ký, mã đặt lại mật khẩu sẽ được gửi đến email đó.";
}
