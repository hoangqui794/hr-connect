using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.ResendPasswordResetOtp;

public record ResendPasswordResetOtpCommand(string Email) : IRequest<ResendPasswordResetOtpResponse>;

public class ResendPasswordResetOtpResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Nếu email đã được đăng ký, mã đặt lại mật khẩu mới sẽ được gửi đến email đó.";
}
