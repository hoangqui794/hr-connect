using System.Diagnostics;
using System.Security.Claims;

namespace HRConnect.Presentation.Middleware;

public sealed class RequestLoggingMiddleware
{
    public const string CorrelationHeaderName = "X-Correlation-ID";
    public const string CorrelationItemKey = "HRConnect.CorrelationId";

    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(
        RequestDelegate next,
        ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(context.Request.Headers[CorrelationHeaderName]);
        var correlationText = correlationId.ToString();
        context.TraceIdentifier = correlationText;
        context.Items[CorrelationItemKey] = correlationId;
        context.Response.Headers[CorrelationHeaderName] = correlationText;

        using var scope = _logger.BeginScope(new Dictionary<string, object?>
        {
            ["CorrelationId"] = correlationText
        });

        var stopwatch = Stopwatch.StartNew();
        await _next(context);
        stopwatch.Stop();

        var userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? context.User.FindFirstValue("sub");
        var method = context.Request.Method;
        var path = context.Request.Path.Value ?? "/";
        var statusCode = context.Response.StatusCode;

        if (statusCode >= StatusCodes.Status400BadRequest)
        {
            _logger.LogWarning(
                "HTTP request completed {Method} {Path} with {StatusCode} in {DurationMs}ms for UserId {UserId}",
                method, path, statusCode, stopwatch.ElapsedMilliseconds, userId);
        }
        else
        {
            _logger.LogInformation(
                "HTTP request completed {Method} {Path} with {StatusCode} in {DurationMs}ms for UserId {UserId}",
                method, path, statusCode, stopwatch.ElapsedMilliseconds, userId);
        }
    }

    private static Guid ResolveCorrelationId(string? providedValue) =>
        Guid.TryParse(providedValue, out var parsed) && parsed != Guid.Empty
            ? parsed
            : Guid.NewGuid();
}
