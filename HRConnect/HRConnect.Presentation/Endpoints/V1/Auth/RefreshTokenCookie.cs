namespace HRConnect.Presentation.Endpoints.V1.Auth;

public static class RefreshTokenCookie
{
    public const string Name = "hrconnect_refresh";
    public const string Path = "/api/v1/auth";

    public static string? Read(HttpRequest request) =>
        request.Cookies.TryGetValue(Name, out var token) && !string.IsNullOrWhiteSpace(token)
            ? token
            : null;

    public static void Write(
        HttpResponse response,
        string token,
        DateTime expiresAt,
        IHostEnvironment environment)
    {
        response.Cookies.Append(Name, token, CreateOptions(environment, expiresAt));
    }

    public static void Delete(HttpResponse response, IHostEnvironment environment)
    {
        response.Cookies.Delete(Name, CreateOptions(environment, DateTime.UnixEpoch));
    }

    private static CookieOptions CreateOptions(IHostEnvironment environment, DateTime expiresAt) => new()
    {
        HttpOnly = true,
        Secure = environment.IsProduction(),
        SameSite = SameSiteMode.Strict,
        Path = Path,
        IsEssential = true,
        Expires = new DateTimeOffset(DateTime.SpecifyKind(expiresAt, DateTimeKind.Utc))
    };
}
