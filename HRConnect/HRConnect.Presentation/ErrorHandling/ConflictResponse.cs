using HRConnect.Application.Common.Exceptions;

namespace HRConnect.Presentation.ErrorHandling;

/// <summary>
/// One 409 body for every endpoint that catches a <see cref="ConflictException"/>. Before (test 21/10) 35 catch
/// blocks returned only the message, so the FE could not tell e.g. REPLACEMENT_SLOT_ALREADY_FILLED from any other
/// conflict. The code is sent as both <c>code</c> and <c>errorCode</c> because the FE already reads either name.
/// </summary>
public static class ConflictResponse
{
    public static IResult From(ConflictException ex) =>
        Results.Conflict(new
        {
            success = false,
            message = ex.Message,
            code = ex.ErrorCode,
            errorCode = ex.ErrorCode,
            details = ex.Details,
        });
}
