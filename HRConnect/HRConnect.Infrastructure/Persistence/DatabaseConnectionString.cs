using Microsoft.Extensions.Configuration;
using Npgsql;

namespace HRConnect.Infrastructure.Persistence;

/// <summary>
/// Picks the database connection string. Render / Supabase give <c>DATABASE_URL</c> as a
/// <c>postgresql://user:pass@host:port/db</c> URL; it wins over <c>ConnectionStrings:DefaultConnection</c> and is
/// turned into the Npgsql format. When the environment is set to something other than Development (or on Render) a localhost database is refused with a clear message,
/// because a local value overriding the deployed one made the 16/10 deploy fail with a confusing socket error.
/// </summary>
public static class DatabaseConnectionString
{
    public static string Resolve(IConfiguration configuration)
    {
        var url = configuration["DATABASE_URL"];
        var connectionString = string.IsNullOrWhiteSpace(url)
            ? configuration.GetConnectionString("DefaultConnection")
            : FromUrl(url.Trim());

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Chưa cấu hình database: đặt DATABASE_URL (postgresql://...) hoặc ConnectionStrings__DefaultConnection.");
        }

        // Only when the environment is set explicitly (or on Render): design-time tools such as `dotnet ef` run with none.
        var environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? configuration["DOTNET_ENVIRONMENT"]
            ?? (string.IsNullOrEmpty(configuration["RENDER"]) ? null : "Render");
        if (environment != null && !string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
            && PointsToLocalhost(connectionString))
        {
            throw new InvalidOperationException(
                $"Môi trường {environment} nhưng chuỗi kết nối database trỏ tới localhost. " +
                "Kiểm tra DATABASE_URL / ConnectionStrings__DefaultConnection trên máy chủ (có thể bị ghi đè bằng giá trị local).");
        }

        return connectionString;
    }

    public static string FromUrl(string url)
    {
        if (!url.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
            !url.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return url; // already in Npgsql key=value form
        }

        var uri = new Uri(url);
        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
        };

        foreach (var part in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pair = part.Split('=', 2);
            var key = Uri.UnescapeDataString(pair[0]);
            var value = pair.Length > 1 ? Uri.UnescapeDataString(pair[1]) : string.Empty;
            if (key.Equals("sslmode", StringComparison.OrdinalIgnoreCase) &&
                Enum.TryParse<SslMode>(value.Replace("-", string.Empty), ignoreCase: true, out var sslMode))
            {
                builder.SslMode = sslMode;
            }
        }

        if (!url.Contains("sslmode", StringComparison.OrdinalIgnoreCase) && !IsLocal(builder.Host))
        {
            builder.SslMode = SslMode.Require; // managed Postgres needs TLS
        }

        return builder.ConnectionString;
    }

    private static bool PointsToLocalhost(string connectionString)
    {
        try
        {
            var builder = new NpgsqlConnectionStringBuilder(connectionString);
            return (builder.Host ?? string.Empty).Split(',').Any(IsLocal);
        }
        catch (ArgumentException)
        {
            return false; // malformed: let Npgsql report it
        }
    }

    private static bool IsLocal(string? host) =>
        host is not null && (host.Trim() is "localhost" or "127.0.0.1" or "::1");
}
