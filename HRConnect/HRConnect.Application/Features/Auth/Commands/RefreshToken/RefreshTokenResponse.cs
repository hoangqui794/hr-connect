using HRConnect.Application.Features.Auth.Commands.Login;

namespace HRConnect.Application.Features.Auth.Commands.RefreshToken;

public class RefreshTokenResponse
{
    public bool Success { get; set; } = true;

    public string Message { get; set; } = "Làm mới token thành công.";

    public RefreshTokenData? Data { get; set; }
}

public class RefreshTokenData
{
    public string AccessToken { get; set; } = string.Empty;

    public string RefreshToken { get; set; } = string.Empty;

    public string TokenType { get; set; } = "Bearer";

    public DateTime ExpiresAt { get; set; }

    public DateTime AccessTokenExpiresAt => ExpiresAt;

    public DateTime RefreshTokenExpiresAt { get; set; }

    public UserInfoData User { get; set; } = new();
}
