namespace HRConnect.Application.Common.Exceptions;

public class ConflictException : Exception
{
    public ConflictException(string message, string? errorCode = null) : base(message)
    {
        ErrorCode = errorCode;
    }

    public string? ErrorCode { get; }
}
