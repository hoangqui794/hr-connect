namespace HRConnect.Application.Common.Exceptions;

public class ForbiddenException : Exception
{
    public string? ErrorCode { get; }

    public ForbiddenException(string message, string? errorCode = null) : base(message)
    {
        ErrorCode = errorCode;
    }
}
