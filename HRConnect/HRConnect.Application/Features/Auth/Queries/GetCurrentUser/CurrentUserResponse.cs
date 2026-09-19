namespace HRConnect.Application.Features.Auth.Queries.GetCurrentUser;

public class CurrentUserResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Lấy thông tin người dùng thành công.";

    public CurrentUserDto? Data { get; set; }
}
