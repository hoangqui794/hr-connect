namespace HRConnect.Application.Features.Auth.Commands.Logout;

public class LogoutResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Đăng xuất thành công.";
}
