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
        var ipAddress = NormalizeIp(context.Connection.RemoteIpAddress);

        return $"user:{userId}:ip:{ipAddress}";
    }

    public static string Ip(HttpContext context) => NormalizeIp(context.Connection.RemoteIpAddress);

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
