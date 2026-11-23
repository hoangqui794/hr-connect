using System.Net;
using System.Security.Claims;

namespace HRConnect.Presentation.RateLimiting;

public static class RateLimitIdentity
{
    public static string UserAndIp(HttpContext context)
    {
        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? context.User.FindFirstValue("sub")
                     ?? "anonymous";
        var ipAddress = Ip(context);

        return $"user:{userId}:ip:{ipAddress}";
    }

    /// <summary>
    /// Resolves the normalized client IP, preferring Cloudflare's CF-Connecting-IP header when valid.
    /// </summary>
    public static string Ip(HttpContext context)
    {
        var cfHeader = context.Request.Headers["CF-Connecting-IP"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(cfHeader) && IPAddress.TryParse(cfHeader.Trim(), out var cfIp))
        {
            return NormalizeIp(cfIp);
        }

        return NormalizeIp(context.Connection.RemoteIpAddress);
    }

    private static string NormalizeIp(IPAddress? address)
    {
        if (address == null)
        {
            return "unknown";
        }

        return address.IsIPv4MappedToIPv6
            ? address.MapToIPv4().ToString()
            : address.ToString();
    }
}
