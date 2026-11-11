using MediatR;

namespace HRConnect.Application.Features.Auth.Commands.SplitAccount;

public record ConfirmSplitRegisterCommand(
    string Email,
    string Password,
    string FullName,
    string? Phone,
    string Otp
) : IRequest<ConfirmSplitRegisterResponse>;

public class ConfirmSplitRegisterResponse
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = "Tách và kích hoạt tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.";
    public ConfirmSplitRegisterData? Data { get; set; }
}

public class ConfirmSplitRegisterData
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Status { get; set; } = "ACTIVE";
}

