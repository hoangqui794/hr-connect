using System.Security.Claims;
using HRConnect.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace HRConnect.Infrastructure.Services.Identity;

public sealed class HttpRequestContext : IRequestContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpRequestContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private HttpContext? Context => _httpContextAccessor.HttpContext;

    public Guid? UserId
    {
        get
        {
            var value = Context?.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? Context?.User.FindFirstValue("sub");
            return Guid.TryParse(value, out var userId) ? userId : null;
        }
    }

    public Guid? CorrelationId =>
        Guid.TryParse(Context?.TraceIdentifier, out var correlationId)
            ? correlationId
            : null;

    public System.Net.IPAddress? IpAddress => Context?.Connection.RemoteIpAddress;

    public string? UserAgent
    {
        get
        {
            var value = Context?.Request.Headers.UserAgent.ToString();
            if (string.IsNullOrWhiteSpace(value)) return null;
            return value.Length <= 512 ? value : value[..512];
        }
    }
}
