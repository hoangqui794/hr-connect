using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.ResendRegistrationOtp;

public record ResendRegistrationOtpCommand(string Email) : IRequest<ResendRegistrationOtpResponse>;

public class ResendRegistrationOtpResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Nếu email đang chờ xác thực, mã OTP đăng ký mới đã được gửi.";
}
