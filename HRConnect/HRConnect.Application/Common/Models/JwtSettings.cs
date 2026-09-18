namespace HRConnect.Application.Common.Models;

public class JwtSettings
{
    public const string SectionName = "JwtSettings";

    public string Secret { get; set; } = "YourSuperSecretKeyWithAtLeast32CharactersLong!123456";

    public string Issuer { get; set; } = "HRConnect";

    public string Audience { get; set; } = "HRConnectApp";

    public int ExpiryMinutes { get; set; } = 60;

    public int RefreshTokenExpiryDays { get; set; } = 7;
}
