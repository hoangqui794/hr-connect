using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HRConnect.Infrastructure.Authentication;

/// <summary>
/// Endpoint filter enforcing service-to-service authentication for internal APIs (e.g. AI Service MF-03).
/// Inspects X-Service-Token header or Authorization Bearer token and verifies against the configured secret.
/// </summary>
public class InternalServiceAuthFilter : IEndpointFilter
{
    public const string HeaderName = "X-Service-Token";
    private readonly IConfiguration _configuration;
    private readonly ILogger<InternalServiceAuthFilter> _logger;

    public InternalServiceAuthFilter(IConfiguration configuration, ILogger<InternalServiceAuthFilter> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var httpContext = context.HttpContext;
        var configuredToken = _configuration["HRCONNECT_SERVICE_TOKEN"]
            ?? _configuration["InternalAuth:ServiceToken"]
            ?? _configuration["HRConnectClient:ServiceToken"];

        if (string.IsNullOrWhiteSpace(configuredToken))
        {
            _logger.LogError("Lỗi cấu hình: Chưa thiết lập biến môi trường HRCONNECT_SERVICE_TOKEN trên máy chủ.");
            return Results.Problem("Lỗi cấu hình xác thực dịch vụ nội bộ.", statusCode: StatusCodes.Status500InternalServerError);
        }

        string? providedToken = null;
        if (httpContext.Request.Headers.TryGetValue(HeaderName, out var tokenHeader) && !string.IsNullOrWhiteSpace(tokenHeader))
        {
            providedToken = tokenHeader.ToString().Trim();
        }
        else if (httpContext.Request.Headers.TryGetValue("Authorization", out var authHeader) && !string.IsNullOrWhiteSpace(authHeader))
        {
            var authVal = authHeader.ToString().Trim();
            if (authVal.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                providedToken = authVal.Substring("Bearer ".Length).Trim();
            }
        }

        if (string.IsNullOrWhiteSpace(providedToken))
        {
            return Results.Json(new
            {
                success = false,
                message = "Thiếu mã xác thực dịch vụ nội bộ (X-Service-Token)."
            }, statusCode: StatusCodes.Status401Unauthorized);
        }

        var providedBytes = Encoding.UTF8.GetBytes(providedToken);
        var configuredBytes = Encoding.UTF8.GetBytes(configuredToken);

        if (providedBytes.Length != configuredBytes.Length ||
            !CryptographicOperations.FixedTimeEquals(providedBytes, configuredBytes))
        {
            _logger.LogWarning("Dịch vụ nội bộ: Mã xác thực không hợp lệ từ IP {RemoteIp}", httpContext.Connection.RemoteIpAddress);
            return Results.Json(new
            {
                success = false,
                message = "Mã xác thực dịch vụ nội bộ không hợp lệ."
            }, statusCode: StatusCodes.Status403Forbidden);
        }

        return await next(context);
    }
}
