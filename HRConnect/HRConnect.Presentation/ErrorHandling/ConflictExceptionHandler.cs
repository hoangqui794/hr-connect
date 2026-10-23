using HRConnect.Application.Common.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace HRConnect.Presentation.ErrorHandling;

/// <summary>
/// Safety net: a <see cref="ConflictException"/> that an endpoint does not catch becomes the same 409 body as
/// <see cref="ConflictResponse"/> instead of a 500.
/// </summary>
public sealed class ConflictExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not ConflictException conflict) return false;

        httpContext.Response.StatusCode = StatusCodes.Status409Conflict;
        await httpContext.Response.WriteAsJsonAsync(new
        {
            success = false,
            message = conflict.Message,
            code = conflict.ErrorCode,
            errorCode = conflict.ErrorCode,
            details = conflict.Details,
        }, cancellationToken);
        return true;
    }
}
