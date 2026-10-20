using Microsoft.AspNetCore.Diagnostics;

namespace HRConnect.Presentation.ErrorHandling;

/// <summary>
/// BUG-02 (test 20/10): a missing or malformed required parameter (for example ?concurrencyToken= on
/// submit/resume) is a client error. Minimal APIs throw BadHttpRequestException; without this handler it
/// surfaced as 500.
/// </summary>
public sealed class BadHttpRequestExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not BadHttpRequestException bad) return false;

        httpContext.Response.StatusCode = bad.StatusCode is >= 400 and < 500 ? bad.StatusCode : StatusCodes.Status400BadRequest;
        await httpContext.Response.WriteAsJsonAsync(new
        {
            success = false,
            code = "INVALID_REQUEST",
            message = "Yêu cầu thiếu hoặc sai tham số bắt buộc.",
            detail = bad.Message,
        }, cancellationToken);
        return true;
    }
}
