namespace HRConnect.Application.Features.Auth.Commands.Login;

public class LoginResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Đăng nhập thành công.";

    public LoginData? Data { get; set; }
}

public class LoginData
{
    public string AccessToken { get; set; } = string.Empty;

    public string RefreshToken { get; set; } = string.Empty;

    public string TokenType { get; set; } = "Bearer";

    public DateTime ExpiresAt { get; set; }
 
    public DateTime AccessTokenExpiresAt => ExpiresAt;

    public DateTime RefreshTokenExpiresAt { get; set; }

    public UserInfoData User { get; set; } = new();
}

public class UserInfoData
{
    public Guid UserId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string? DisplayName { get; set; }

    public string Status { get; set; } = string.Empty;

    public List<string> Roles { get; set; } = new();

    public List<string> Permissions { get; set; } = new();
}
