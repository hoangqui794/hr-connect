namespace HRConnect.Application.Features.Auth.Commands.LogoutAll;

public class LogoutAllResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Đăng xuất khỏi tất cả thiết bị thành công.";
}
