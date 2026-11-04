using System.Text;
using HRConnect.Infrastructure.Persistence;

namespace HRConnect.Presentation.Configuration;

public static class ProductionConfigurationValidator
{
    private const string LegacyJwtSecret = "YourSuperSecretKeyWithAtLeast32CharactersLong!123456";

    public static void Validate(IConfiguration configuration, IHostEnvironment environment)
    {
        if (!environment.IsProduction())
        {
            return;
        }

        var errors = new List<string>();

        Require(configuration, "JwtSettings:Issuer", errors);
        Require(configuration, "JwtSettings:Audience", errors);
        ValidateJwtSecret(configuration["JwtSettings:Secret"], errors);
        Require(configuration, "HRCONNECT_SERVICE_TOKEN", errors);
        Require(configuration, "VNPAY_TMN_CODE", errors);
        Require(configuration, "VNPAY_HASH_SECRET", errors);

        ValidateHttpsUrl(configuration, "PUBLIC_API_BASE_URL", errors);
        ValidateHttpsUrl(configuration, "SUBMISSION_CONSENT_URL_BASE", errors);
        ValidateHttpsUrl(configuration, "VNPAY_PAYMENT_URL", errors);
        ValidateHttpsUrl(configuration, "VNPAY_RETURN_URL", errors);
        ValidateMf03Url(configuration["MF03_BASE_URL"], errors);
        ValidateCorsOrigins(configuration, errors);

        try
        {
            _ = DatabaseConnectionString.Resolve(configuration);
        }
        catch
        {
            errors.Add("DATABASE_URL / ConnectionStrings:DefaultConnection không hợp lệ");
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                "Cấu hình Production không hợp lệ:\n- " + string.Join("\n- ", errors.Distinct()));
        }
    }

    private static void Require(IConfiguration configuration, string key, ICollection<string> errors)
    {
        if (string.IsNullOrWhiteSpace(configuration[key]))
        {
            errors.Add($"{key} chưa được cấu hình");
        }
    }

    private static void ValidateJwtSecret(string? secret, ICollection<string> errors)
    {
        if (string.IsNullOrWhiteSpace(secret))
        {
            errors.Add("JwtSettings:Secret chưa được cấu hình");
            return;
        }

        var normalized = secret.Trim().ToLowerInvariant();
        var looksLikePlaceholder = secret == LegacyJwtSecret
            || normalized.Contains("yoursupersecret", StringComparison.Ordinal)
            || normalized.Contains("changeme", StringComparison.Ordinal)
            || normalized.Contains("replace", StringComparison.Ordinal)
            || normalized.Contains("example", StringComparison.Ordinal);

        if (Encoding.UTF8.GetByteCount(secret) < 32 || looksLikePlaceholder)
        {
            errors.Add("JwtSettings:Secret phải là bí mật mạnh, tối thiểu 32 byte và không dùng giá trị mẫu");
        }
    }

    private static void ValidateHttpsUrl(
        IConfiguration configuration,
        string key,
        ICollection<string> errors)
    {
        if (!Uri.TryCreate(configuration[key], UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps)
        {
            errors.Add($"{key} phải là URL HTTPS tuyệt đối");
        }
    }

    private static void ValidateMf03Url(string? value, ICollection<string> errors)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps
                && !(uri.Scheme == Uri.UriSchemeHttp && IsPrivateServiceHost(uri.Host))))
        {
            errors.Add("MF03_BASE_URL phải dùng HTTPS hoặc HTTP nội bộ giữa các container");
        }
    }

    private static bool IsPrivateServiceHost(string host) =>
        host.Equals("ai-v2", StringComparison.OrdinalIgnoreCase)
        || host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase);

    private static void ValidateCorsOrigins(IConfiguration configuration, ICollection<string> errors)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (origins.Length == 0)
        {
            errors.Add("Cors:AllowedOrigins phải có ít nhất một origin HTTPS");
            return;
        }

        foreach (var origin in origins)
        {
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                || uri.Scheme != Uri.UriSchemeHttps
                || uri.AbsolutePath != "/"
                || !string.IsNullOrEmpty(uri.Query)
                || !string.IsNullOrEmpty(uri.Fragment))
            {
                errors.Add("Cors:AllowedOrigins chỉ được chứa origin HTTPS chính xác, không có path/query/fragment");
                return;
            }
        }
    }
}
