using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.VerifyEmailOtp;

public record VerifyEmailOtpCommand(
    string Email,
    string Otp
) : IRequest<VerifyEmailOtpResponse>;

public class VerifyEmailOtpResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Xác thực email thành công. Tài khoản đã được kích hoạt.";

    public VerifyEmailOtpData? Data { get; set; }
}

public class VerifyEmailOtpData
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Status { get; set; } = "ACTIVE";

    public DateTime EmailVerifiedAt { get; set; }
}
